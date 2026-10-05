/**
 * Anthropic adapter: the official SDK, called straight from the browser.
 *
 * `dangerouslyAllowBrowser` makes the SDK send the
 * `anthropic-dangerous-direct-browser-access: true` header that Anthropic
 * requires for CORS. That is appropriate here because the key belongs to the
 * visitor and only ever travels from their browser to api.anthropic.com.
 *
 * Structured output uses `output_config.format` with the schema produced by
 * the SDK's `zodOutputFormat` helper. The reply is handled in a fixed order:
 * first why the model stopped (a refusal or a reply cut off at `max_tokens`
 * is reported as such, not as a format error), then JSON parsing, then zod
 * validation. Every failure carries the raw text and token usage so the
 * audit log can show what came back and what it cost.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { SERVER_FALLBACK_BETA, supportsEffort, usesServerFallback } from "./models";
import { parseStructured } from "./schema";
import {
  AiError,
  type FetchLike,
  type StructuredRequest,
  type StructuredResponse,
  type TokenUsage,
} from "./types";

export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  // Most specific first: APIConnectionError and the status errors all extend APIError.
  if (err instanceof Anthropic.APIUserAbortError) return new AiError("aborted");
  if (err instanceof Anthropic.APIConnectionError) return new AiError("network", err.message);
  if (err instanceof Anthropic.AuthenticationError)
    return new AiError("invalid-key", undefined, 401);
  if (err instanceof Anthropic.PermissionDeniedError)
    return new AiError("permission", err.message, 403);
  if (err instanceof Anthropic.RateLimitError) return new AiError("rate-limit", undefined, 429);
  if (err instanceof Anthropic.BadRequestError) return new AiError("bad-request", err.message, 400);
  if (err instanceof Anthropic.NotFoundError) return new AiError("bad-request", err.message, 404);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new AiError("overloaded", undefined, 529);
    return new AiError("server", err.message, err.status);
  }
  if (err instanceof Anthropic.AnthropicError) return new AiError("invalid-output", err.message);
  if (err instanceof DOMException && err.name === "AbortError") return new AiError("aborted");
  return new AiError("network", err instanceof Error ? err.message : String(err));
}

/** The parts of a (beta or regular) Message this adapter reads. */
interface MessageLike {
  model: string;
  content: ReadonlyArray<{ type: string; text?: string }>;
  stop_reason: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
  usage: { input_tokens: number; output_tokens: number };
}

export async function callAnthropic<T>(
  apiKey: string,
  model: string,
  req: StructuredRequest<T>,
  { fetch, signal }: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<StructuredResponse<T>> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: 90_000,
    ...(fetch ? { fetch } : {}),
  });
  const maxTokens = req.maxTokens ?? 4096;
  const format = zodOutputFormat(req.schema);
  const base = {
    model,
    max_tokens: maxTokens,
    // The grounding context is long and identical across calls: mark it cacheable.
    system: [
      { type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } },
    ],
    messages: [{ role: "user" as const, content: req.user }],
    output_config: {
      format: { type: "json_schema" as const, schema: format.schema },
      // Short factual answers: keep Sonnet's thinking light. Haiku 4.5 takes no effort.
      ...(supportsEffort(model) ? { effort: "low" as const } : {}),
    },
  };

  let message: MessageLike;
  try {
    message = usesServerFallback(model)
      ? await client.beta.messages.create(
          { ...base, betas: [SERVER_FALLBACK_BETA], fallbacks: "default" },
          { signal },
        )
      : await client.messages.create(base, { signal });
  } catch (err) {
    throw toAiError(err);
  }

  const rawText = message.content.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
  const usage: TokenUsage = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
  const evidence = { rawText, usage };
  if (message.stop_reason === "refusal") {
    throw new AiError(
      "refusal",
      message.stop_details?.explanation ?? message.stop_details?.category ?? undefined,
      undefined,
      evidence,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiError("truncated", `limit ${maxTokens} tokens`, undefined, evidence);
  }
  const data = parseStructured(req.schema, rawText, evidence);
  return { data, rawText, model: message.model, usage };
}
