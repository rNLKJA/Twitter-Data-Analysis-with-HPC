/**
 * Structured-output plumbing shared by both providers: the JSON schema sent
 * to OpenAI (strict mode, built from the zod schema) and the reply parser
 * that validates with the same zod schema. Anthropic's copy of the schema
 * comes from the SDK's own `zodOutputFormat` helper (see ./anthropic.ts).
 */
import { z } from "zod";

import { AiError, type AiErrorEvidence } from "./types";

export type JsonSchema = { [key: string]: unknown };

/** Strict mode: all properties required, no additional properties, no `$schema`. */
export function strictJsonSchema(schema: JsonSchema): JsonSchema {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (node === null || typeof node !== "object") return node;
    const out: JsonSchema = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema") continue;
      out[k] = visit(v);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    return out;
  };
  return visit(schema) as JsonSchema;
}

/** Schema for OpenAI's `response_format` (strict mode). */
export function openAiJsonSchema(schema: z.ZodType): JsonSchema {
  return strictJsonSchema(z.toJSONSchema(schema) as JsonSchema);
}

/** Parse the model's text as JSON and validate it; failures carry the evidence. */
export function parseStructured<T>(
  schema: z.ZodType<T>,
  rawText: string,
  evidence: AiErrorEvidence,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AiError("invalid-output", "reply was not valid JSON", undefined, evidence);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiError(
      "invalid-output",
      result.error.issues[0]?.message ?? "schema mismatch",
      undefined,
      evidence,
    );
  }
  return result.data;
}
