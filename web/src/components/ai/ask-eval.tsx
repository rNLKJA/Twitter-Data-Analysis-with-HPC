"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  FlaskConical,
  LoaderCircle,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  compareRuns,
  errorKindOf,
  EVAL_CSV_COLUMNS,
  EVAL_ITEMS,
  EVAL_SET_VERSION,
  evalResultsCsvRows,
  fallbackItems,
  hasScoredItems,
  paramDifferences,
  scoreResult,
  summariseEval,
  type EvalItem,
  type EvalRun,
} from "@/lib/ai/ask/eval";
import { runEvaluation } from "@/lib/ai/ask/run";
import { isFatalKind, PROVIDER_LABEL, type Provider, type RequestParams } from "@/lib/ai/types";
import { toCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";
import { formatPct } from "@/lib/format";
import type { Interval } from "@/lib/stats/interval";

import { AiBadge } from "./ai-badge";
import { useAi } from "./ai-provider";

const STORE_KEY = "spartan-tweet-cruncher.ai.eval-runs";
const MAX_RUNS = 6;
const ANSWERABLE = EVAL_ITEMS.filter((i) => i.answerable).length;

function loadRuns(): EvalRun[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const runs = raw ? (JSON.parse(raw) as EvalRun[]) : [];
    // A run interrupted by a reload is no longer running.
    return runs.map((r) => (r.status === "running" ? { ...r, status: "stopped" } : r));
  } catch {
    return [];
  }
}

function expected(item: EvalItem): string {
  if (!item.answerable) return "should decline";
  if (item.expect?.label) return item.expect.label;
  const approx = (item.expect?.tolerance ?? 0) > 0;
  const nums = (item.expect?.numbers ?? []).map((n) =>
    Number.isInteger(n)
      ? n.toLocaleString("en-AU")
      : `${approx ? "≈ " : ""}${n.toFixed(2)}${approx ? ` (±${Math.round(item.expect!.tolerance! * 100)}%)` : ""}`,
  );
  return [...(item.expect?.text ?? []), ...nums].join(", ");
}

function Rate({
  label,
  r,
  hint,
}: {
  label: string;
  r: Interval & { k: number; n: number };
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="num font-heading text-lg font-semibold">
        {r.n ? formatPct(r.estimate, 0) : "–"}{" "}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {r.k}/{r.n}
        </span>
      </dd>
      <dd className="text-[0.7rem] text-muted-foreground">
        {r.n ? `95% CI ${formatPct(r.lo, 0)} to ${formatPct(r.hi, 0)}` : "no items"}
        {hint ? <span className="block">{hint}</span> : null}
      </dd>
    </div>
  );
}

const providerLabel = (p: string) => PROVIDER_LABEL[p as Provider] ?? p;

function runLabel(r: EvalRun) {
  const time = new Date(r.startedAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${providerLabel(r.provider)} ${r.model} · ${time}${r.status === "done" ? "" : ` (${r.status})`}`;
}

/** "max 4,096 tokens, effort low, fallback default" */
function paramsText(p: RequestParams | undefined): string {
  if (!p) return "settings not recorded";
  return [
    `max ${p.maxTokens.toLocaleString("en-AU")} output tokens`,
    p.effort ? `effort ${p.effort}` : "provider-default effort",
    p.serverFallback ? `server-side fallback ${p.serverFallback}` : "no fallback",
    `prompt sha256 ${p.promptSha256.slice(0, 8)}…`,
  ].join(", ");
}

/** Why a stopped run stopped, from its last result (null if it was stopped between items). */
function stopReason(run: EvalRun) {
  if (run.status !== "stopped") return null;
  const last = run.results.at(-1);
  const kind = last ? errorKindOf(last) : null;
  if (!last || !kind || !isFatalKind(kind)) return null;
  const message = last.error?.replace(/^[a-z-]+:\s*/, "") ?? kind;
  return { kind, message, itemId: last.itemId };
}

export function AskEval({ contextHash }: { contextHash: string }) {
  const { ready, credentials, audit, openSettings } = useAi();
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const id = useId();

  // Session storage is read after hydration (the server has none).
  useEffect(() => {
    const stored = loadRuns();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from browser storage
    setRuns(stored);
    if (stored.length) setSelected(stored[0].id);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = (next: EvalRun[]) => {
    setRuns(next);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or disabled: keep in memory */
    }
  };

  const start = async () => {
    if (!credentials) {
      openSettings();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    let latest: EvalRun[] = runs;
    try {
      await runEvaluation(credentials, {
        audit,
        contextHash,
        signal: controller.signal,
        onProgress: (r) => {
          latest = [r, ...runs.filter((x) => x.id !== r.id)].slice(0, MAX_RUNS);
          persist(latest);
          setSelected(r.id);
        },
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const current = runs.find((r) => r.id === selected) ?? runs[0] ?? null;
  const summary = useMemo(() => (current ? summariseEval(current.results) : null), [current]);
  // Only runs with at least one scored item can be compared.
  const comparable = runs.filter(
    (r) => r.setVersion === EVAL_SET_VERSION && r.status !== "running" && hasScoredItems(r),
  );
  const [aId, bId] = pair ?? [comparable[0]?.id, comparable[1]?.id];
  const runA = comparable.find((r) => r.id === aId);
  const runB = comparable.find((r) => r.id === bId);
  const sameRun = !runA || !runB || runA.id === runB.id;
  const paired = !sameRun ? compareRuns(runA, runB) : null;
  const differences = !sameRun ? paramDifferences(runA, runB) : [];
  const stopped = current ? stopReason(current) : null;

  const exportCsv = (r: EvalRun) =>
    downloadText(`${r.id}.csv`, toCsv(evalResultsCsvRows(r), EVAL_CSV_COLUMNS), "text/csv");
  const exportJson = (r: EvalRun) =>
    downloadText(
      `${r.id}.json`,
      `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          note: "Grounding evaluation of 'Ask the results'. Answers are AI-generated; grades come from an answer key computed from the tables.",
          run: r,
          summary: summariseEval(r.results),
          items: EVAL_ITEMS,
        },
        null,
        2,
      )}\n`,
      "application/json",
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
            <Square aria-hidden /> Stop
          </Button>
        ) : (
          <Button onClick={start} disabled={!ready}>
            <FlaskConical aria-hidden />{" "}
            {credentials
              ? `Run the ${EVAL_ITEMS.length} questions on ${credentials.model}`
              : "Add a key to run"}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {EVAL_ITEMS.length} requests, one at a time, roughly 3,000 input tokens each, billed to
          your key{credentials ? ` (${PROVIDER_LABEL[credentials.provider]})` : ""}.
        </p>
        {running && current && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> {current.results.length}/
            {EVAL_ITEMS.length}
          </span>
        )}
      </div>

      {stopped && !running && (
        <div
          role={stopped.kind === "aborted" ? "status" : "alert"}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="min-w-0 flex-1">
            {stopped.kind === "aborted"
              ? `You stopped this run at item ${stopped.itemId}.`
              : `The run stopped at item ${stopped.itemId}: ${stopped.message}`}{" "}
            Items it did not reach are not scored.
          </p>
          {(stopped.kind === "invalid-key" ||
            stopped.kind === "missing-key" ||
            stopped.kind === "permission") && (
            <Button size="sm" variant="outline" onClick={openSettings}>
              AI settings
            </Button>
          )}
        </div>
      )}

      {runs.length > 0 && current && summary && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-run`} className="text-xs font-medium">
              Run
            </label>
            <select
              id={`${id}-run`}
              value={current.id}
              onChange={(e) => setSelected(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {runLabel(r)}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-1.5">
              <Button variant="outline" size="xs" onClick={() => exportCsv(current)}>
                <Download aria-hidden /> CSV
              </Button>
              <Button variant="outline" size="xs" onClick={() => exportJson(current)}>
                <Download aria-hidden /> JSON
              </Button>
              <Button
                variant="ghost"
                size="xs"
                disabled={running}
                onClick={() => {
                  persist([]);
                  setSelected(null);
                  setPair(null);
                }}
              >
                <Trash2 aria-hidden /> Clear runs
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3 lg:grid-cols-5">
            <Rate
              label="Answerable, correct"
              r={summary.answerable}
              hint="right values, right rows"
            />
            <Rate label="Declined correctly" r={summary.refusals} hint="unanswerable items" />
            <Rate label="False refusals" r={summary.falseRefusals} hint="lower is better" />
            <Rate
              label="Citations that exist"
              r={summary.citationValidity}
              hint="descriptive: citations are not independent"
            />
            <Rate label="Call errors" r={summary.callErrors} hint="scored as fails" />
          </dl>
          <p className="text-xs text-muted-foreground">
            {providerLabel(current.provider)} · {current.model} · {paramsText(current.params)} ·
            question set {current.setVersion} · context sha256{" "}
            <code className="font-mono">{current.contextHash.slice(0, 12)}…</code>. {summary.scored}{" "}
            of {EVAL_ITEMS.length} items scored. A call that fails on an item counts as a fail (a
            provider refusal on an unanswerable item counts as a correct decline), so failing on
            hard items cannot raise the score.
            {summary.notScored.length > 0 &&
              (summary.notScored.length <= 6
                ? ` Not scored because the run stopped before answering them: ${summary.notScored.join(", ")}.`
                : ` ${summary.notScored.length} items are not scored because the run stopped before answering them (listed in the JSON export).`)}
            {fallbackItems(current).length > 0 &&
              ` Answered by a fallback model, not ${current.model}: ${fallbackItems(current).join(", ")}.`}{" "}
            Intervals are Wilson 95%; with {ANSWERABLE} and {EVAL_ITEMS.length - ANSWERABLE} items
            they are wide by design, so read them as a check, not a benchmark score.
          </p>

          <p className="text-xs text-muted-foreground sm:hidden">
            Swipe the table sideways for the answers and grades.
          </p>

          <div
            className="overflow-x-auto rounded-lg border"
            tabIndex={0}
            role="region"
            aria-label="Evaluation items, scrollable"
          >
            <table className="w-full min-w-[46rem] text-xs">
              <caption className="sr-only">
                Each evaluation question, the answer key, the AI-generated answer and its grade
              </caption>
              <thead className="bg-muted/30">
                <tr className="text-left font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground uppercase">
                  <th scope="col" className="px-2.5 py-2 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-2.5 py-2 font-medium">
                    Question
                  </th>
                  <th scope="col" className="px-2.5 py-2 font-medium">
                    Key
                  </th>
                  <th scope="col" className="px-2.5 py-2 font-medium">
                    Answer <span className="normal-case">(AI-generated)</span>
                  </th>
                  <th scope="col" className="px-2.5 py-2 font-medium">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {EVAL_ITEMS.map((item) => {
                  const r = current.results.find((x) => x.itemId === item.id);
                  return (
                    <tr key={item.id} className="border-t border-border/60 align-top">
                      <th scope="row" className="px-2.5 py-1.5 text-left font-mono font-medium">
                        {item.id}
                      </th>
                      <td className="max-w-56 px-2.5 py-1.5">{item.question}</td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{expected(item)}</td>
                      <td className="max-w-72 px-2.5 py-1.5">
                        {!r ? (
                          <span className="text-muted-foreground">–</span>
                        ) : r.answer ? (
                          <>
                            <span className="font-mono text-[0.65rem] text-muted-foreground">
                              {r.answer.status === "answered" ? "answered" : "declined"}
                              {r.answer.citations.length
                                ? ` · ${r.answer.citations.join(" ")}`
                                : ""}
                            </span>
                            <span className="block">{r.answer.answer}</span>
                          </>
                        ) : (
                          <span className="text-destructive">{r.error}</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5">
                        {r && !r.grade ? (
                          (() => {
                            const o = scoreResult(r);
                            return o === null ? (
                              <span className="text-muted-foreground">not scored</span>
                            ) : o.pass ? (
                              <span className="inline-flex items-center gap-1 text-success">
                                <CircleCheck className="size-3.5" aria-hidden /> pass (declined)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-destructive">
                                <CircleX className="size-3.5" aria-hidden /> fail (call error)
                              </span>
                            );
                          })()
                        ) : r?.grade ? (
                          r.grade.pass ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CircleCheck className="size-3.5" aria-hidden /> pass
                            </span>
                          ) : (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-destructive">
                                <CircleX className="size-3.5" aria-hidden /> fail
                              </span>
                              <span className="text-[0.68rem] text-muted-foreground">
                                {r.grade.reasons.join("; ")}
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">{r ? "not graded" : "–"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AiBadge /> Answers in this table are model output; grades come from the answer key.
          </div>
        </div>
      )}

      {comparable.length >= 2 && (
        <section aria-labelledby={`${id}-pair`} className="space-y-3 rounded-lg border p-4">
          <h3 id={`${id}-pair`} className="font-heading text-sm font-semibold">
            Paired comparison of two runs
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor={`${id}-a`}>A</label>
            <select
              id={`${id}-a`}
              value={aId}
              onChange={(e) => setPair([e.target.value, bId!])}
              className="h-8 rounded-lg border border-input bg-transparent px-2"
            >
              {comparable.map((r) => (
                <option key={r.id} value={r.id}>
                  {runLabel(r)}
                </option>
              ))}
            </select>
            <label htmlFor={`${id}-b`}>B</label>
            <select
              id={`${id}-b`}
              value={bId}
              onChange={(e) => setPair([aId!, e.target.value])}
              className="h-8 rounded-lg border border-input bg-transparent px-2"
            >
              {comparable.map((r) => (
                <option key={r.id} value={r.id}>
                  {runLabel(r)}
                </option>
              ))}
            </select>
          </div>
          {!sameRun && (
            <dl className="grid gap-1 text-xs text-muted-foreground">
              {(
                [
                  ["A", runA],
                  ["B", runB],
                ] as const
              ).map(([label, r]) => (
                <div key={label} className="flex gap-1.5">
                  <dt className="font-mono font-medium text-foreground">{label}</dt>
                  <dd className="min-w-0">
                    {providerLabel(r.provider)} {r.model}: {paramsText(r.params)}
                    {fallbackItems(r).length > 0 &&
                      `; ${fallbackItems(r).length} item(s) answered by a fallback model`}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {differences.length > 0 && (
            <p
              className="flex items-start gap-2 rounded-md bg-caution/10 px-2.5 py-1.5 text-xs"
              role="note"
            >
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-caution" aria-hidden />
              The runs differ in more than the model: {differences.join(", ")}. The difference below
              mixes those effects.
            </p>
          )}
          {sameRun ? (
            <p className="text-xs text-muted-foreground">Pick two different runs.</p>
          ) : !paired ? (
            <p className="text-xs text-muted-foreground">No items were scored by both runs.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                On the {paired.n} items both runs scored, A passed{" "}
                <strong>{paired.bothPass + paired.onlyA}</strong> and B passed{" "}
                <strong>{paired.bothPass + paired.onlyB}</strong>. They disagree on{" "}
                {paired.onlyA + paired.onlyB} item{paired.onlyA + paired.onlyB === 1 ? "" : "s"} (
                {paired.onlyA} only A, {paired.onlyB} only B).
              </p>
              <p>
                Difference in pass rate (A − B):{" "}
                <strong className="num font-mono">
                  {formatPct(paired.difference.estimate, 1)}
                </strong>{" "}
                <span className="text-muted-foreground">
                  (paired bootstrap 95% CI {formatPct(paired.difference.lo, 1)} to{" "}
                  {formatPct(paired.difference.hi, 1)}; exact McNemar p ={" "}
                  {paired.p < 0.001 ? paired.p.toExponential(1) : paired.p.toFixed(3)})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Only the items where the runs disagree carry information about the difference, so
                McNemar&apos;s test uses exactly those. Failed calls are scored as fails in both
                runs. Bootstrap: 2,000 resamples of items, seed 90024.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
