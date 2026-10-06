/**
 * One entry point for every AI call: picks the provider adapter, times the
 * call, and appends an audit entry (success or failure) before returning.
 */
import { callAnthropic } from "./anthropic";
import { newAuditId, type AuditEntry, type AuditStore, type HumanDecision } from "./audit-log";
import { sha256HexOrUnavailable } from "./hash";
import { requestParams } from "./models";
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
  /**
   * False when the answer arrived but could not be written to the audit log
   * (for example, browser storage is full). The answer is still returned:
   * the visitor has paid for it, and the UI says it is not logged.
   */
  logged: boolean;
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
  const params = requestParams(
    credentials.provider,
    credentials.model,
    await sha256HexOrUnavailable(req.system),
    req.maxTokens,
  );
  const base = {
    id: newAuditId(),
    timestamp: clock().toISOString(),
    feature: req.feature,
    provider: credentials.provider,
    model: credentials.model,
    params,
    // The request payload only. The key is never part of an entry.
    input: { system: req.system, user: req.user, schema: req.schemaName },
    contextHash,
    humanDecision,
    ...(context ? { context } : {}),
  } satisfies Partial<AuditEntry>;

  const started = now();
  let res: StructuredResponse<T>;
  try {
    if (!credentials.apiKey.trim()) throw new AiError("missing-key");
    const call = credentials.provider === "anthropic" ? callAnthropic : callOpenAI;
    res = await call(credentials.apiKey.trim(), credentials.model, req, { fetch, signal });
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

  const entry: AuditEntry = {
    ...base,
    servedModel: res.model || null,
    output: res.data,
    outputText: res.rawText,
    error: null,
    latencyMs: now() - started,
    usage: res.usage,
  };
  // The call succeeded and is paid for: a logging failure must not throw the answer away.
  let logged = true;
  try {
    await audit.add(entry);
  } catch {
    logged = false;
  }
  return { ...res, entry, logged };
}
