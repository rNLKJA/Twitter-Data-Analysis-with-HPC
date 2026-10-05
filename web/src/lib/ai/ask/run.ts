/**
 * Calling the model for "Ask the results" and running the evaluation set.
 * Both go through callStructured, so every call is audit-logged with the
 * SHA-256 of the context the model was given.
 */
import type { AuditStore } from "../audit-log";
import { callStructured, type CallResult } from "../client";
import { AiError, isFatalForBatch, type Credentials, type FetchLike } from "../types";
import {
  ASK_SCHEMA_NAME,
  ASK_SYSTEM_PROMPT,
  AskAnswerSchema,
  cleanQuestion,
  type AskAnswer,
} from "./answer";
import {
  EVAL_ITEMS,
  EVAL_SET_VERSION,
  gradeAnswer,
  type EvalItem,
  type EvalResult,
  type EvalRun,
} from "./eval";

export interface AskOptions {
  audit: AuditStore;
  /** sha256Hex(ASK_CONTEXT), computed once by the caller. */
  contextHash: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
}

export function askResults(
  credentials: Credentials,
  question: string,
  opts: AskOptions & {
    feature?: "ask" | "ask-eval";
    context?: Record<string, string | number | boolean | null>;
  },
): Promise<CallResult<AskAnswer>> {
  const q = cleanQuestion(question);
  if (!q) return Promise.reject(new AiError("bad-request", "empty question"));
  const evaluation = opts.feature === "ask-eval";
  return callStructured(
    credentials,
    {
      feature: opts.feature ?? "ask",
      system: ASK_SYSTEM_PROMPT,
      user: q,
      schema: AskAnswerSchema,
      schemaName: ASK_SCHEMA_NAME,
    },
    {
      audit: opts.audit,
      contextHash: opts.contextHash,
      fetch: opts.fetch,
      signal: opts.signal,
      // Evaluation answers are graded by the answer key, not reviewed by a person.
      humanDecision: evaluation ? "not-applicable" : "pending",
      context: opts.context,
    },
  );
}

const newRunId = () =>
  `eval-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Ask every item in turn (sequentially, to stay inside rate limits), grade
 * each answer, and report progress. Stops early on an error that would
 * repeat for every item (bad key, rate limit, network) or on abort.
 */
export async function runEvaluation(
  credentials: Credentials,
  opts: AskOptions & {
    items?: readonly EvalItem[];
    onProgress?: (run: EvalRun) => void;
    clock?: () => Date;
  },
): Promise<EvalRun> {
  const clock = opts.clock ?? (() => new Date());
  let run: EvalRun = {
    id: newRunId(),
    setVersion: EVAL_SET_VERSION,
    provider: credentials.provider,
    model: credentials.model,
    contextHash: opts.contextHash,
    startedAt: clock().toISOString(),
    finishedAt: null,
    status: "running",
    results: [],
  };
  const publish = (patch: Partial<EvalRun>) => {
    run = { ...run, ...patch };
    opts.onProgress?.(run);
  };
  publish({});
  for (const item of opts.items ?? EVAL_ITEMS) {
    if (opts.signal?.aborted) {
      publish({ status: "stopped", finishedAt: clock().toISOString() });
      return run;
    }
    try {
      const res = await askResults(credentials, item.question, {
        ...opts,
        feature: "ask-eval",
        context: { evalRun: run.id, item: item.id, setVersion: EVAL_SET_VERSION },
      });
      const result: EvalResult = {
        itemId: item.id,
        answer: res.data,
        grade: gradeAnswer(item, res.data),
        error: null,
        auditId: res.entry.id,
        latencyMs: res.entry.latencyMs,
        inputTokens: res.usage?.inputTokens ?? null,
        outputTokens: res.usage?.outputTokens ?? null,
      };
      publish({ results: [...run.results, result] });
    } catch (err) {
      const e = err instanceof AiError ? err : new AiError("network", String(err));
      publish({
        results: [
          ...run.results,
          {
            itemId: item.id,
            answer: null,
            grade: null,
            error: `${e.kind}: ${e.message}`,
            auditId: null,
            latencyMs: 0,
            inputTokens: e.usage?.inputTokens ?? null,
            outputTokens: e.usage?.outputTokens ?? null,
          },
        ],
      });
      if (isFatalForBatch(e)) {
        publish({ status: "stopped", finishedAt: clock().toISOString() });
        return run;
      }
    }
  }
  publish({ status: "done", finishedAt: clock().toISOString() });
  return run;
}
