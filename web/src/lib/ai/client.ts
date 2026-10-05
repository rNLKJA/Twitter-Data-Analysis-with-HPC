/**
 * One entry point for every AI call: picks the provider adapter, times the
 * call, and appends an audit entry (success or failure) before returning.
 */
import { callAnthropic } from "./anthropic";
import { newAuditId, type AuditEntry, type AuditStore, type HumanDecision } from "./audit-log";
import { callOpenAI } from "./openai";
import {
  AiError,
  type Credentials,
  type FetchLike,
  type StructuredRequest,
  type StructuredResponse,
} from "./types";

export interface CallOptions {
  audit: AuditStore;
  /** SHA-256 of the grounding context sent in the system prompt. */
  contextHash?: string | null;
  fetch?: FetchLike;
  signal?: AbortSignal;
  /** Decision recorded with the entry (default "pending": a human reviews it). */
  humanDecision?: HumanDecision;
  context?: AuditEntry["context"];
  now?: () => number;
  clock?: () => Date;
}

export interface CallResult<T> extends StructuredResponse<T> {
  entry: AuditEntry;
}

export async function callStructured<T>(
  credentials: Credentials,
  req: StructuredRequest<T>,
  {
    audit,
    contextHash = null,
    fetch,
    signal,
    humanDecision = "pending",
    context,
    now = () => performance.now(),
    clock = () => new Date(),
  }: CallOptions,
): Promise<CallResult<T>> {
  const base = {
    id: newAuditId(),
    timestamp: clock().toISOString(),
    feature: req.feature,
    provider: credentials.provider,
    model: credentials.model,
    // The request payload only. The key is never part of an entry.
    input: { system: req.system, user: req.user, schema: req.schemaName },
    contextHash,
    humanDecision,
    ...(context ? { context } : {}),
  } satisfies Partial<AuditEntry>;

  const started = now();
  try {
    if (!credentials.apiKey.trim()) throw new AiError("missing-key");
    const call = credentials.provider === "anthropic" ? callAnthropic : callOpenAI;
    const res = await call(credentials.apiKey.trim(), credentials.model, req, { fetch, signal });
    const entry: AuditEntry = {
      ...base,
      model:
        res.model && res.model !== credentials.model
          ? `${credentials.model} → ${res.model}`
          : credentials.model,
      output: res.data,
      outputText: res.rawText,
      error: null,
      latencyMs: now() - started,
      usage: res.usage,
    };
    await audit.add(entry);
    return { ...res, entry };
  } catch (err) {
    const error = err instanceof AiError ? err : new AiError("network", String(err));
    const entry: AuditEntry = {
      ...base,
      output: null,
      // Whatever came back (a cut-off or malformed reply) and the tokens it
      // cost are kept, so the evidence behind a failure can be inspected.
      outputText: error.rawText,
      error: { kind: error.kind, message: error.message },
      latencyMs: now() - started,
      usage: error.usage,
      humanDecision: humanDecision === "pending" ? "not-applicable" : humanDecision,
    };
    // A failed call is still logged; never let logging hide the real error.
    await audit.add(entry).catch(() => undefined);
    throw error;
  }
}
