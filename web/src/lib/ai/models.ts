/**
 * Model choices. Claude model ids come from Anthropic's current model list
 * (checked October 2026). The AI features are optional extras paid for with
 * the visitor's own key, so the low-cost Haiku tier is the default and Sonnet
 * is offered for harder questions. The OpenAI model id is free text so
 * visitors can use whatever their key has access to.
 */
import type { Provider, RequestParams } from "./types";

export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "default, lowest cost" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "stronger, about twice the cost" },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = ANTHROPIC_MODELS[0].id;
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
};

/** Sonnet 5.5 takes an effort setting (Haiku 4.5 rejects one). */
export const supportsEffort = (model: string) => model.startsWith("claude-sonnet-5");

/**
 * Sonnet 5.5 can decline on safety grounds; Anthropic's server-side fallback
 * (`fallbacks: "default"`) then lets another Claude model answer in the same
 * call. The audit log records the model that actually served the answer.
 */
export const usesServerFallback = (model: string) => model === "claude-sonnet-5-5";
export const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Output-token budget for every structured call (both providers). */
export const DEFAULT_MAX_TOKENS = 4096;

/** Effort sent to models that take one: short factual answers need little thinking. */
export const ANTHROPIC_EFFORT = "low" as const;

/**
 * The settings a call will be made with, for the audit log. The adapters read
 * the same helpers, so what is logged is what is sent.
 */
export function requestParams(
  provider: Provider,
  model: string,
  promptSha256: string,
  maxTokens = DEFAULT_MAX_TOKENS,
): RequestParams {
  const anthropic = provider === "anthropic";
  return {
    maxTokens,
    effort: anthropic && supportsEffort(model) ? ANTHROPIC_EFFORT : null,
    serverFallback: anthropic && usesServerFallback(model) ? "default" : null,
    promptSha256,
  };
}

/** True when the provider reports a different model than the one requested (not just a dated snapshot of it). */
export const isFallbackModel = (requested: string, served: string | null | undefined) =>
  !!served && !served.startsWith(requested);
