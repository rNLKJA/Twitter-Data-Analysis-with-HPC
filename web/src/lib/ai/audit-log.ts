/**
 * Audit log for every AI call. This is a static site, so the log lives in the
 * visitor's own browser (IndexedDB), viewable and exportable at /ai-log.
 *
 * An entry records what was sent (system prompt, user prompt, schema name),
 * the SHA-256 of the grounding context, what came back, the provider and
 * model, latency, token usage when the provider reports it, and the human
 * decision. It never contains the API key: entries are built from the
 * request payload only, and the key is passed to the adapters separately.
 */
import { toCsv, type CsvValue } from "../csv";
import type { AiErrorKind, AiFeature, Provider, RequestParams, TokenUsage } from "./types";

export type HumanDecision = "pending" | "accepted" | "edited" | "rejected" | "not-applicable";

export const DECISION_LABEL: Record<HumanDecision, string> = {
  pending: "Awaiting review",
  accepted: "Accepted",
  edited: "Edited",
  rejected: "Rejected",
  "not-applicable": "n/a (automated evaluation)",
};

/** One human review action, kept in order so an edit is never lost by a later accept. */
export interface DecisionRecord {
  decision: Exclude<HumanDecision, "pending" | "not-applicable">;
  /** The edited answer, for "edited". */
  editedOutput?: string;
  at: string;
}

export interface AuditEntry {
  id: string;
  /** ISO 8601 time the call started. */
  timestamp: string;
  feature: AiFeature;
  provider: Provider;
  /** Model requested. */
  model: string;
  /**
   * Model the provider reported serving the call: usually a dated snapshot of
   * the requested alias, or another model when a server-side fallback answered.
   */
  servedModel?: string | null;
  /** Request settings (token limit, effort, fallback, system prompt hash). */
  params?: RequestParams;
  input: { system: string; user: string; schema: string };
  /** SHA-256 (hex) of the grounding context the model was given, if any. */
  contextHash: string | null;
  /** Validated structured output, or null on error. */
  output: unknown;
  /** Raw model text, when there was any (also kept when validation failed). */
  outputText: string | null;
  error: { kind: AiErrorKind; message: string } | null;
  latencyMs: number;
  usage: TokenUsage | null;
  /** The latest review decision. */
  humanDecision: HumanDecision;
  /** The human's most recent edit of the answer (kept if a later decision follows it). */
  editedOutput?: string;
  decidedAt?: string;
  /** Every review decision, oldest first. */
  decisions?: DecisionRecord[];
  /** Non-sensitive context such as the evaluation run and item. */
  context?: Record<string, string | number | boolean | null>;
}

export interface AuditStore {
  add(entry: AuditEntry): Promise<void>;
  update(id: string, patch: Partial<Omit<AuditEntry, "id">>): Promise<void>;
  list(): Promise<AuditEntry[]>;
  clear(): Promise<void>;
}

export const newAuditId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** In-memory store (tests, and browsers without IndexedDB). */
export class MemoryAuditStore implements AuditStore {
  private entries = new Map<string, AuditEntry>();

  async add(entry: AuditEntry) {
    this.entries.set(entry.id, structuredClone(entry));
    notify();
  }

  async update(id: string, patch: Partial<Omit<AuditEntry, "id">>) {
    const current = this.entries.get(id);
    if (current) this.entries.set(id, { ...current, ...structuredClone(patch) });
    notify();
  }

  async list() {
    return [...this.entries.values()]
      .map((e) => structuredClone(e))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async clear() {
    this.entries.clear();
    notify();
  }
}

const DB_NAME = "spartan-tweet-cruncher-ai";
const STORE = "audit";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB-backed store, one database per origin. */
export class IndexedDbAuditStore implements AuditStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  private async store(mode: IDBTransactionMode) {
    const db = await this.open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async add(entry: AuditEntry) {
    await request((await this.store("readwrite")).put(entry));
    notify();
  }

  async update(id: string, patch: Partial<Omit<AuditEntry, "id">>) {
    const store = await this.store("readwrite");
    const current = (await request(store.get(id))) as AuditEntry | undefined;
    if (current) await request(store.put({ ...current, ...patch }));
    notify();
  }

  async list() {
    const all = (await request((await this.store("readonly")).getAll())) as AuditEntry[];
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async clear() {
    await request((await this.store("readwrite")).clear());
    notify();
  }
}

/** Same-tab change notifications so open views (e.g. /ai-log) can refresh. */
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
export function onAuditChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let shared: AuditStore | null = null;
/** The browser's audit store (IndexedDB when available). */
export function getAuditStore(): AuditStore {
  if (!shared) {
    shared = typeof indexedDB !== "undefined" ? new IndexedDbAuditStore() : new MemoryAuditStore();
  }
  return shared;
}

export function auditToJson(entries: readonly AuditEntry[], exportedAt = new Date()): string {
  return `${JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      note: "Spartan Tweet Cruncher AI audit log, exported from this browser. API keys are never recorded.",
      entries,
    },
    null,
    2,
  )}\n`;
}

export const AUDIT_CSV_COLUMNS = [
  "id",
  "timestamp",
  "feature",
  "provider",
  "model",
  "served_model",
  "max_tokens",
  "effort",
  "server_fallback",
  "prompt_sha256",
  "context_sha256",
  "latency_ms",
  "input_tokens",
  "output_tokens",
  "human_decision",
  "decided_at",
  "error_kind",
  "error_message",
  "system_prompt",
  "user_prompt",
  "schema",
  "output",
  "output_text",
  "edited_output",
  "decisions",
  "context",
] as const;

export function auditToCsv(entries: readonly AuditEntry[]): string {
  const rows: Record<string, CsvValue>[] = entries.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    feature: e.feature,
    provider: e.provider,
    model: e.model,
    served_model: e.servedModel ?? null,
    max_tokens: e.params?.maxTokens ?? null,
    effort: e.params?.effort ?? null,
    server_fallback: e.params?.serverFallback ?? null,
    prompt_sha256: e.params?.promptSha256 ?? null,
    context_sha256: e.contextHash,
    latency_ms: Math.round(e.latencyMs),
    input_tokens: e.usage?.inputTokens ?? null,
    output_tokens: e.usage?.outputTokens ?? null,
    human_decision: e.humanDecision,
    decided_at: e.decidedAt ?? null,
    error_kind: e.error?.kind ?? null,
    error_message: e.error?.message ?? null,
    system_prompt: e.input.system,
    user_prompt: e.input.user,
    schema: e.input.schema,
    output: e.output === null || e.output === undefined ? null : JSON.stringify(e.output),
    output_text: e.outputText,
    edited_output: e.editedOutput ?? null,
    decisions: e.decisions?.length ? JSON.stringify(e.decisions) : null,
    context: e.context ? JSON.stringify(e.context) : null,
  }));
  return toCsv(rows, AUDIT_CSV_COLUMNS);
}
