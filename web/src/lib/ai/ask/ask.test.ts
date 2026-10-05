import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { BENCHMARKS, TASK1, TASK2, TASK3 } from "../../data/original";
import { MemoryAuditStore } from "../audit-log";
import { sha256Hex } from "../hash";
import type { FetchLike } from "../types";
import {
  ASK_SYSTEM_PROMPT,
  AskAnswerSchema,
  checkGrounding,
  cleanQuestion,
  hasGroundingIssue,
  type AskAnswer,
} from "./answer";
import { ASK_CONTEXT, CONTEXT_TABLES, ROW_INDEX, rowText } from "./context";
import {
  compareRuns,
  EVAL_ITEMS,
  fallbackItems,
  gradeAnswer,
  hasScoredItems,
  paramDifferences,
  scoreResult,
  summariseEval,
  type EvalItem,
  type EvalRun,
} from "./eval";
import { extractNumbers, sameNumber } from "./numbers";
import { askResults, runEvaluation } from "./run";

const answered = (answer: string, citations: string[], calculation = ""): AskAnswer => ({
  status: "answered",
  answer,
  citations,
  calculation,
});
const refused: AskAnswer = {
  status: "not_answerable",
  answer: "The tables only give totals per capital city.",
  citations: [],
  calculation: "",
};
const item = (id: string) => EVAL_ITEMS.find((i) => i.id === id)!;

describe("grounding context", () => {
  it("contains every original row, verbatim, under a stable id", () => {
    expect(CONTEXT_TABLES.map((t) => t.id)).toEqual(["D", "T1", "T2", "T3", "B1", "B2"]);
    expect(ROW_INDEX.size).toBe(7 + TASK1.length + TASK2.length + TASK3.length + 3 + 3);
    expect(rowText("T2.2")).toBe("T2.2 | 2gmel | Greater Melbourne | 2284909");
    expect(rowText("T1.1")).toBe(`T1.1 | 1 | ${TASK1[0].authorId} | ${TASK1[0].tweets}`);
    for (const r of TASK3) expect(ASK_CONTEXT).toContain(r.text);
    expect(rowText("B1.2")).toContain(BENCHMARKS[1].jobId);
    expect(rowText("X.1")).toBeNull();
    // No derived quantities: the model must show its own arithmetic.
    expect(ASK_CONTEXT).not.toMatch(/speedup/i);
  });

  it("is what the system prompt carries, and hashes the same in Node and Web Crypto", async () => {
    expect(ASK_SYSTEM_PROMPT).toContain(`<context>\n${ASK_CONTEXT}</context>`);
    const node = createHash("sha256").update(ASK_CONTEXT, "utf8").digest("hex");
    expect(await sha256Hex(ASK_CONTEXT)).toBe(node);
  });

  it("validates the answer shape", () => {
    expect(AskAnswerSchema.safeParse(refused).success).toBe(true);
    expect(AskAnswerSchema.safeParse({ ...refused, status: "maybe" }).success).toBe(false);
    expect(cleanQuestion("  How   many\n tweets?  ")).toBe("How many tweets?");
    expect(cleanQuestion("x".repeat(900))).toHaveLength(500);
  });
});

describe("number extraction", () => {
  it("reads counts, decimals, percentages and clock times, ignoring row ids", () => {
    const found = extractNumbers(
      "Melbourne had 2,284,909 tweets (T2.2); CPU 87.13%; 1:41 and 00:11:01.",
    );
    expect(found.map((n) => n.value)).toEqual([101, 661, 2284909, 87.13]);
    expect(extractNumbers("All ten authors", { words: true }).map((n) => n.value)).toEqual([10]);
    expect(extractNumbers("All ten authors").length).toBe(0);
  });

  it("compares long ids digit for digit", () => {
    const [a] = extractNumbers("1429984556451389440");
    const [b] = extractNumbers("1429984556451389441");
    expect(sameNumber(a, b)).toBe(false);
    expect(sameNumber(a, a)).toBe(true);
  });
});

describe("checkGrounding", () => {
  it("passes an answer whose numbers come from its cited rows", () => {
    const c = checkGrounding(answered("Greater Melbourne recorded 2,284,909 tweets.", ["T2.2"]));
    expect(c).toEqual({
      invalidCitations: [],
      uncited: false,
      untracedNumbers: [],
      arithmeticErrors: [],
      unverifiedInputs: [],
      refusalWithCitations: false,
    });
    expect(hasGroundingIssue(c)).toBe(false);
  });

  it("accepts derived numbers when the arithmetic is shown", () => {
    const c = checkGrounding(
      answered("The 8-core job was 6.54 times faster.", ["B1.1", "B1.2"], "661 / 101 = 6.54"),
    );
    expect(c.untracedNumbers).toEqual([]);
  });

  it("requires whole numbers to match exactly and decimals to match as rounded", () => {
    expect(checkGrounding(answered("About 21,000 tweets.", ["T1.5"])).untracedNumbers).toEqual([
      "21,000",
    ]);
    expect(
      checkGrounding(answered("CPU utilisation was 87.1%.", ["B1.2"])).untracedNumbers,
    ).toEqual([]);
    expect(
      checkGrounding(answered("CPU utilisation was 87.2%.", ["B1.2"])).untracedNumbers,
    ).toEqual(["87.2"]);
    expect(checkGrounding(answered("It took 1:41.", ["B1.3"])).untracedNumbers).toEqual([]);
  });

  it("reads counts inside the verbatim Task 3 cells", () => {
    const c = checkGrounding(answered("They tweeted 1,879 times from Melbourne.", ["T3.1"]));
    expect(c.untracedNumbers).toEqual([]);
  });

  it("checks the arithmetic, not just that a number appears in the calculation", () => {
    // Transposed digits in the sum: the arithmetic fails and the total is not traced.
    const wrongSum = checkGrounding(
      answered(
        "Sydney and Melbourne together had 4,503,589 tweets.",
        ["T2.1", "T2.2"],
        "2,218,689 + 2,284,909 = 4,503,589",
      ),
    );
    expect(wrongSum.arithmeticErrors).toEqual(["2,218,689 + 2,284,909 = 4,503,589"]);
    expect(wrongSum.untracedNumbers).toEqual(["4,503,589"]);
    expect(hasGroundingIssue(wrongSum)).toBe(true);

    const rightSum = checkGrounding(
      answered(
        "Together they had 4,503,598 tweets.",
        ["T2.1", "T2.2"],
        "Sydney 2,218,689 + Melbourne 2,284,909 = 4,503,598",
      ),
    );
    expect(hasGroundingIssue(rightSum)).toBe(false);

    // A made-up figure repeated in the calculation is still untraced.
    const repeated = checkGrounding(
      answered("Sydney had 3,500,000 tweets.", ["T2.1"], "3,500,000"),
    );
    expect(repeated.untracedNumbers).toEqual(["3,500,000"]);
    const fabricatedInputs = checkGrounding(
      answered("Sydney had 3,500,000 tweets.", ["T2.1"], "1,750,000 + 1,750,000 = 3,500,000"),
    );
    expect(fabricatedInputs.unverifiedInputs).toEqual(["1,750,000"]);
    expect(fabricatedInputs.untracedNumbers).toEqual(["3,500,000"]);
  });

  it("follows chained calculations, clock times, labels and percentages", () => {
    const c = checkGrounding(
      answered(
        "The 1 node × 8 cores job was 6.54 times faster, an efficiency of 81.8%.",
        ["B1.1", "B1.2"],
        "Speedup S(8) = T1 / T8 = 11:01 / 1:41 = 661 / 101 ≈ 6.54; efficiency = 6.54 / 8 = 0.818 = 81.8%",
      ),
    );
    expect(c).toMatchObject({ arithmeticErrors: [], unverifiedInputs: [], untracedNumbers: [] });
    const sloppyChain = checkGrounding(
      answered(
        "Efficiency was 0.82.",
        ["B1.1", "B1.2"],
        "8-core speedup = 661 / 101 = 6.54 / 8 = 0.82",
      ),
    );
    expect(sloppyChain).toMatchObject({ arithmeticErrors: [], untracedNumbers: [] });
    const difference = checkGrounding(
      answered(
        "Melbourne led Sydney by 66,220 tweets.",
        ["T2.1", "T2.2"],
        "2,284,909 − 2,218,689 = 66,220",
      ),
    );
    expect(hasGroundingIssue(difference)).toBe(false);
    const wrongRatio = checkGrounding(
      answered("It was 7.54 times faster.", ["B1.1", "B1.2"], "661 / 101 = 7.54"),
    );
    expect(wrongRatio.arithmeticErrors).toHaveLength(1);
    expect(wrongRatio.untracedNumbers).toEqual(["7.54"]);
  });

  it("flags made-up rows, uncited answers and numbers it cannot trace", () => {
    const c = checkGrounding(answered("Melbourne had 2,300,000 tweets.", ["T2.99"]));
    expect(c.invalidCitations).toEqual(["T2.99"]);
    expect(c.uncited).toBe(true);
    expect(c.untracedNumbers).toEqual(["2,300,000"]);
    expect(hasGroundingIssue(c)).toBe(true);
    expect(checkGrounding({ ...refused, citations: ["T2.1"] }).refusalWithCitations).toBe(true);
  });
});

describe("evaluation set", () => {
  it("has unique ids, a balance of answerable and unanswerable items, and valid keys", () => {
    expect(new Set(EVAL_ITEMS.map((i) => i.id)).size).toBe(EVAL_ITEMS.length);
    expect(EVAL_ITEMS.filter((i) => i.answerable)).toHaveLength(14);
    expect(EVAL_ITEMS.filter((i) => !i.answerable)).toHaveLength(10);
    for (const i of EVAL_ITEMS.filter((x) => x.answerable)) {
      for (const id of [...(i.citeAny ?? []), ...(i.citeAll ?? [])])
        expect(ROW_INDEX.has(id), id).toBe(true);
      expect(
        (i.expect?.numbers?.length ?? 0) +
          (i.expect?.text?.length ?? 0) +
          (i.expect?.claim ? 1 : 0),
      ).toBeGreaterThan(0);
    }
  });

  it("never keys an answer to a number the question already contains", () => {
    for (const i of EVAL_ITEMS.filter((x) => x.answerable)) {
      const asked = extractNumbers(i.question, { words: true });
      for (const v of i.expect?.numbers ?? []) {
        const inQuestion = asked.some((q) =>
          sameNumber(q, { value: v, digits: null, decimals: 0, text: "" }),
        );
        expect(inQuestion, `${i.id}: ${v} is in the question`).toBe(false);
      }
    }
  });

  it("derives the answer key from the data", () => {
    expect(item("A01").expect!.numbers).toEqual([2_284_909]);
    expect(item("A02").expect!.numbers).toEqual([46_772]);
    expect(item("A05").expect!.numbers).toEqual([101]);
    // All ten Task 3 authors tweeted from all eight cities: graded as a claim, not a number.
    expect(item("A07").expect!.claim).toBeDefined();
    expect(item("A07").expect!.label).toBe("all 10");
    expect(item("A08").expect!.numbers).toEqual([1879]);
    expect(item("A09").expect!.numbers![0]).toBeCloseTo(6.5446, 3);
    expect(item("A11").expect!.numbers).toEqual([4_503_598]);
    expect(item("A13").expect!.numbers).toEqual([1383]);
    expect(item("A14").expect!.numbers).toEqual([193]);
  });

  it("does not pass wrong answers that only repeat the question's numbers", () => {
    for (const wrong of [
      "None of the top ten authors tweeted from all eight capital cities.",
      "Only 9 of the top 10 authors tweeted from all eight capital cities.",
      "Seven of the top ten did.",
      "Eight of the top ten authors did.",
      "None of them tweeted from each of the eight cities.",
    ]) {
      const g = gradeAnswer(item("A07"), answered(wrong, ["T3.1"]));
      expect(g.pass, wrong).toBe(false);
      expect(g.reasons.join()).toMatch(/expected the answer to say all 10/);
    }
    // A05 asks about "2 nodes × 4 cores": repeating 2 and 4 is not the 101 s it needs.
    expect(gradeAnswer(item("A05"), answered("The 2 × 4 job took 4 minutes.", ["B1.3"])).pass).toBe(
      false,
    );
  });

  it("grades answers on content, citations and refusals", () => {
    expect(gradeAnswer(item("A01"), answered("2,284,909 tweets.", ["T2.2"])).pass).toBe(true);
    const wrongRow = gradeAnswer(item("A01"), answered("2,284,909 tweets.", ["T2.1"]));
    expect(wrongRow).toMatchObject({ pass: false, contentCorrect: true, citationCorrect: false });
    const wrongNumber = gradeAnswer(item("A01"), answered("2,218,689 tweets.", ["T2.2"]));
    expect(wrongNumber.pass).toBe(false);
    expect(wrongNumber.reasons[0]).toMatch(/expected 2284909/);
    expect(gradeAnswer(item("A05"), answered("It took 1:41 (101 seconds).", ["B1.3"])).pass).toBe(
      true,
    );
    expect(gradeAnswer(item("A07"), answered("All ten of them.", ["T3.1"])).pass).toBe(true);
    expect(
      gradeAnswer(
        item("A07"),
        answered("All 10 authors in the top ten tweeted from all eight capital cities.", ["T3.1"]),
      ).pass,
    ).toBe(true);
    expect(gradeAnswer(item("A07"), answered("10 of the top 10 did.", ["T3.1"])).pass).toBe(true);
    expect(gradeAnswer(item("A09"), answered("About 6.5 times.", ["B1.1", "B1.2"])).pass).toBe(
      true,
    );
    expect(gradeAnswer(item("A09"), answered("6.54 times.", ["B1.2"])).pass).toBe(false);
    expect(gradeAnswer(item("A02"), answered("Hobart, 91,112.", ["T2.6"])).pass).toBe(false);
    const falseRefusal = gradeAnswer(item("A03"), refused);
    expect(falseRefusal).toMatchObject({ pass: false, statusCorrect: false });
    expect(gradeAnswer(item("U01"), refused).pass).toBe(true);
    const hallucinated = gradeAnswer(item("U06"), answered("About 0:20 on 64 cores.", ["B9.1"]));
    expect(hallucinated).toMatchObject({ pass: false, validCitations: 0, totalCitations: 1 });
  });
});

function run(
  id: string,
  passes: Record<string, boolean>,
  errors: string[] = [],
  errorKind = "server",
): EvalRun {
  return {
    id,
    setVersion: "test",
    provider: "anthropic",
    model: id,
    contextHash: "h",
    startedAt: "",
    finishedAt: "",
    status: "done",
    results: EVAL_ITEMS.map((i) => {
      if (errors.includes(i.id))
        return {
          itemId: i.id,
          answer: null,
          grade: null,
          error: `${errorKind}: failed`,
          auditId: null,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        };
      const pass = passes[i.id] ?? true;
      return {
        itemId: i.id,
        answer: null,
        grade: {
          itemId: i.id,
          statusCorrect: pass || !i.answerable ? pass : true,
          contentCorrect: null,
          citationCorrect: null,
          validCitations: 1,
          totalCitations: 1,
          pass,
          reasons: [],
        },
        error: null,
        auditId: null,
        latencyMs: 1,
        inputTokens: 1,
        outputTokens: 1,
      };
    }),
  };
}

describe("summaries and paired comparison", () => {
  it("scores failed calls as fails (intention to treat), with Wilson intervals", () => {
    const s = summariseEval(run("a", { A01: false, U01: false }, ["A02"]).results);
    expect(s.scored).toBe(24);
    expect(s.graded).toBe(23);
    expect(s.notScored).toEqual([]);
    expect(s.callErrors).toMatchObject({ k: 1, n: 24 });
    expect(s.answerable).toMatchObject({ k: 12, n: 14 });
    expect(s.refusals).toMatchObject({ k: 9, n: 10 });
    expect(s.overall).toMatchObject({ k: 21, n: 24 });
    expect(s.answerable.lo).toBeGreaterThan(0.55);
    expect(s.answerable.hi).toBeLessThan(1);
    expect(s.citationValidity).toMatchObject({ k: 23, n: 23 });
  });

  it("cannot raise its score by failing on hard items", () => {
    // One pass and one malformed reply on answerable items: 1/2, not 1/1.
    const items = run("x", {}).results.filter((r) => r.itemId === "A01" || r.itemId === "A02");
    const results = [items[0], { ...items[1], grade: null, error: "invalid-output: bad JSON" }];
    const s = summariseEval(results);
    expect(s.answerable).toMatchObject({ k: 1, n: 2 });
    expect(s.callErrors).toMatchObject({ k: 1, n: 2 });
  });

  it("counts a provider refusal as a correct decline only on unanswerable items", () => {
    const r = run("r", {}, ["U01", "A03"], "refusal");
    expect(scoreResult(r.results.find((x) => x.itemId === "U01")!)).toMatchObject({ pass: true });
    expect(scoreResult(r.results.find((x) => x.itemId === "A03")!)).toMatchObject({
      pass: false,
      falseRefusal: true,
    });
    expect(summariseEval(r.results).falseRefusals).toMatchObject({ k: 1, n: 14 });
  });

  it("leaves out, and lists, only items a batch-stopping error never answered", () => {
    const stopped = run("s", {}, ["A02"], "rate-limit");
    stopped.results = stopped.results.filter((r) => ["A01", "A02"].includes(r.itemId));
    const s = summariseEval(stopped.results);
    expect(s.scored).toBe(1);
    expect(s.notScored).toHaveLength(23);
    expect(s.notScored).toContain("A02");
    expect(hasScoredItems(stopped)).toBe(true);
    const nothing = { ...stopped, results: stopped.results.filter((r) => r.itemId === "A02") };
    expect(hasScoredItems(nothing)).toBe(false);
  });

  it("compares two runs item by item, scoring errors the same way", () => {
    const a = run("a", { A01: true, A02: true, U01: true });
    const b = run("b", { A01: false, A02: false, U01: false, A03: false });
    const c = compareRuns(a, b)!;
    expect(c).toMatchObject({ n: 24, onlyA: 4, onlyB: 0 });
    expect(c.difference.estimate).toBeCloseTo(4 / 24, 12);
    expect(c.p).toBeCloseTo(0.125, 12);
    // A server error on A01 is a fail, so the item stays in the comparison.
    const d = compareRuns(a, run("c", {}, ["A01"]))!;
    expect(d.n).toBe(24);
    expect(d).toMatchObject({ onlyA: 1, onlyB: 0 });
    // A batch-stopping error leaves the item out.
    const e = compareRuns(a, run("e", {}, ["A01"], "invalid-key"))!;
    expect(e.n).toBe(23);
    expect(e.items).not.toContain("A01");
  });

  it("returns no comparison when the runs share no scored item", () => {
    const a = run("a", {});
    const empty = { ...run("b", {}), results: [] };
    expect(compareRuns(a, empty)).toBeNull();
  });

  it("flags settings that differ and items a fallback model answered", () => {
    const params = { maxTokens: 4096, effort: null, serverFallback: null, promptSha256: "p" };
    const a = { ...run("a", {}), params };
    const b = { ...run("b", {}), params: { ...params, effort: "low", serverFallback: "default" } };
    expect(paramDifferences(a, a)).toEqual([]);
    expect(paramDifferences(a, b)).toEqual(["reasoning effort", "server-side fallback"]);
    expect(paramDifferences(a, { ...a, contextHash: "other" })).toEqual(["grounding context"]);
    const withFallback = {
      ...b,
      model: "claude-sonnet-5-5",
      results: b.results.map((r, i) => ({
        ...r,
        servedModel: i === 0 ? "claude-opus-5-5" : "claude-sonnet-5-5-20260901",
      })),
    };
    expect(fallbackItems(withFallback)).toEqual(["A01"]);
  });
});

describe("askResults and runEvaluation (fetch mocked)", () => {
  const creds = {
    provider: "anthropic" as const,
    model: "claude-haiku-4-5",
    apiKey: "sk-ant-secret-key-123",
  };
  const reply = (a: AskAnswer) =>
    new Response(
      JSON.stringify({
        id: "m",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: JSON.stringify(a) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 2500, output_tokens: 60 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  it("logs a question with the context hash and leaves the decision to a person", async () => {
    const audit = new MemoryAuditStore();
    const fetch = vi.fn(async () =>
      reply(answered("2,284,909 tweets.", ["T2.2"])),
    ) as unknown as FetchLike;
    const hash = await sha256Hex(ASK_CONTEXT);
    const res = await askResults(creds, "  How many tweets in Melbourne? ", {
      audit,
      contextHash: hash,
      fetch,
    });
    expect(res.data.citations).toEqual(["T2.2"]);
    const [e] = await audit.list();
    expect(e).toMatchObject({ feature: "ask", contextHash: hash, humanDecision: "pending" });
    expect(e.input.user).toBe("How many tweets in Melbourne?");
    expect(JSON.stringify(e)).not.toContain(creds.apiKey);
    await expect(
      askResults(creds, "   ", { audit, contextHash: hash, fetch }),
    ).rejects.toMatchObject({
      kind: "bad-request",
    });
  });

  it("asks every item, grades it, and stops on a fatal error", async () => {
    const audit = new MemoryAuditStore();
    const items: EvalItem[] = [item("A01"), item("U01"), item("A03")];
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return reply(answered("2,284,909 tweets.", ["T2.2"]));
      if (calls === 2) return reply(refused);
      return new Response(
        JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "slow" } }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as FetchLike;
    const progress: number[] = [];
    const out = await runEvaluation(creds, {
      audit,
      contextHash: "h",
      fetch,
      items,
      onProgress: (r) => progress.push(r.results.length),
    });
    expect(out.status).toBe("stopped");
    expect(out.results.map((r) => r.grade?.pass ?? null)).toEqual([true, true, null]);
    expect(out.results[2].error).toMatch(/^rate-limit/);
    expect(out.results[2].errorKind).toBe("rate-limit");
    expect(out.results[0].servedModel).toBe("claude-haiku-4-5");
    expect(out.params).toMatchObject({ maxTokens: 4096, effort: null, serverFallback: null });
    expect(out.params!.promptSha256).toBe(await sha256Hex(ASK_SYSTEM_PROMPT));
    expect(progress.at(-1)).toBe(3);
    const entries = await audit.list();
    expect(entries).toHaveLength(3);
    expect(entries.filter((e) => e.feature === "ask-eval")).toHaveLength(3);
    expect(entries.every((e) => e.humanDecision === "not-applicable")).toBe(true);
    expect(entries.find((e) => e.output)!.context).toMatchObject({ evalRun: out.id });
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn() as unknown as FetchLike;
    const out = await runEvaluation(creds, {
      audit: new MemoryAuditStore(),
      contextHash: "h",
      fetch,
      signal: controller.signal,
    });
    expect(out.status).toBe("stopped");
    expect(out.results).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
