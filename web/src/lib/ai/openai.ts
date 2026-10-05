/**
 * OpenAI adapter: Chat Completions with a strict JSON-schema response format,
 * called straight from the browser with the visitor's own key. The reply is
 * validated with the same zod schema as the Anthropic one, under the same
 * output-token budget, and failures carry the same evidence.
 */
import { openAiJsonSchema, parseStructured } from "./schema";
import {
  AiError,
  type FetchLike,
  type StructuredRequest,
  type StructuredResponse,
  type TokenUsage,
} from "./types";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

interface ChatCompletion {
  model?: string;
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string; type?: string };
}

export async function callOpenAI<T>(
  apiKey: string,
  model: string,
  req: StructuredRequest<T>,
  {
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
    signal,
  }: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<StructuredResponse<T>> {
  const maxTokens = req.maxTokens ?? 4096;
  const body = {
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: req.schemaName, strict: true, schema: openAiJsonSchema(req.schema) },
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new AiError("aborted");
    // fetch rejects with a TypeError for offline, DNS and CORS failures alike.
    throw new AiError("network", err instanceof Error ? err.message : String(err));
  }

  let json: ChatCompletion = {};
  try {
    json = (await res.json()) as ChatCompletion;
  } catch {
    if (res.ok) throw new AiError("invalid-output", "response was not JSON");
  }

  if (!res.ok) {
    const detail = json.error?.message;
    if (res.status === 401) throw new AiError("invalid-key", undefined, 401);
    if (res.status === 403) throw new AiError("permission", detail, 403);
    if (res.status === 429) throw new AiError("rate-limit", json.error?.code ?? undefined, 429);
    if (res.status === 400 || res.status === 404)
      throw new AiError("bad-request", detail, res.status);
    if (res.status === 503) throw new AiError("overloaded", undefined, 503);
    throw new AiError("server", detail, res.status);
  }

  const choice = json.choices?.[0];
  const usage: TokenUsage | null = json.usage
    ? {
        inputTokens: json.usage.prompt_tokens ?? 0,
        outputTokens: json.usage.completion_tokens ?? 0,
      }
    : null;
  const rawText = choice?.message?.content ?? "";
  if (choice?.message?.refusal) {
    throw new AiError("refusal", choice.message.refusal, undefined, {
      rawText: rawText || choice.message.refusal,
      usage,
    });
  }
  if (choice?.finish_reason === "length") {
    throw new AiError("truncated", `limit ${maxTokens} tokens`, undefined, { rawText, usage });
  }
  const data = parseStructured(req.schema, rawText, { rawText, usage });
  return { data, rawText, model: json.model ?? model, usage };
}
