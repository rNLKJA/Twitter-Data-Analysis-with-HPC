/**
 * Model choices. Claude model ids come from Anthropic's current model list
 * (checked October 2026). The AI features are optional extras paid for with
 * the visitor's own key, so the low-cost Haiku tier is the default and Sonnet
 * is offered for harder questions. The OpenAI model id is free text so
 * visitors can use whatever their key has access to.
 */
import type { Provider } from "./types";

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
