/**
 * Shared types for the optional bring-your-own-key AI features.
 *
 * The visitor's key lives only in their browser (sessionStorage by default)
 * and is sent only to the provider they chose, straight from the browser.
 * This site is static: it has no server that could receive the key.
 */
import type { z } from "zod";

export type Provider = "anthropic" | "openai";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};

/** Features that call a model. Every call is audit-logged under one of these. */
export type AiFeature = "ask" | "ask-eval";

export const FEATURE_LABEL: Record<AiFeature, string> = {
  ask: "Ask the results",
  "ask-eval": "Grounding evaluation",
};

export interface Credentials {
  provider: Provider;
  model: string;
  apiKey: string;
}

export interface StructuredRequest<T> {
  feature: AiFeature;
  system: string;
  user: string;
  /** Output schema; the provider is asked for JSON matching it and the reply is validated. */
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredResponse<T> {
  data: T;
  /** The model's raw text (JSON) before validation. */
  rawText: string;
  usage: TokenUsage | null;
  /** Model id reported by the provider (it can differ from the one requested). */
  model: string;
}

export type AiErrorKind =
  | "missing-key"
  | "invalid-key"
  | "permission"
  | "rate-limit"
  | "overloaded"
  | "network"
  | "bad-request"
  | "server"
  | "refusal"
  | "truncated"
  | "invalid-output"
  | "aborted";

const MESSAGES: Record<AiErrorKind, string> = {
  "missing-key": "Add your API key in AI settings to use this feature.",
  "invalid-key": "The provider rejected the API key. Check it in AI settings.",
  permission: "This key is not allowed to use that model.",
  "rate-limit":
    "The provider is rate-limiting this key (or it is out of credit). Wait a moment and try again.",
  overloaded: "The provider is temporarily overloaded. Try again shortly.",
  network:
    "Could not reach the provider. Check your connection; a browser extension or network policy may be blocking cross-origin (CORS) requests.",
  "bad-request": "The provider rejected the request.",
  server: "The provider returned a server error.",
  refusal: "The model declined to answer.",
  truncated: "The model's reply was cut off before it finished.",
  "invalid-output": "The model's reply did not match the expected format.",
  aborted: "The request was cancelled.",
};

/**
 * What the provider returned even though the call failed (a reply cut off at
 * the token limit, a refusal, or JSON that did not match the schema). Kept so
 * the audit log records the evidence and the tokens that were billed.
 */
export interface AiErrorEvidence {
  rawText?: string | null;
  usage?: TokenUsage | null;
}

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly rawText: string | null;
  readonly usage: TokenUsage | null;

  constructor(kind: AiErrorKind, detail?: string, status?: number, evidence: AiErrorEvidence = {}) {
    super(detail ? `${MESSAGES[kind]} (${detail})` : MESSAGES[kind]);
    this.name = "AiError";
    this.kind = kind;
    this.status = status;
    this.rawText = evidence.rawText ?? null;
    this.usage = evidence.usage ?? null;
  }
}

export const isAiError = (e: unknown): e is AiError => e instanceof AiError;

/** Errors after which repeating the same call cannot succeed (stop a batch). */
export const isFatalForBatch = (e: AiError) =>
  e.kind === "missing-key" ||
  e.kind === "invalid-key" ||
  e.kind === "permission" ||
  e.kind === "rate-limit" ||
  e.kind === "network" ||
  e.kind === "aborted";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
