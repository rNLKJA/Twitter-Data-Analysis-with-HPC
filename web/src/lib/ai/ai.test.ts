import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { callAnthropic } from "./anthropic";
import {
  auditToCsv,
  auditToJson,
  AUDIT_CSV_COLUMNS,
  MemoryAuditStore,
  type AuditEntry,
} from "./audit-log";
import { callStructured } from "./client";
import { sha256Hex } from "./hash";
import { callOpenAI, OPENAI_URL } from "./openai";
import { openAiJsonSchema, parseStructured, strictJsonSchema } from "./schema";
import {
  DEFAULT_PREFS,
  forgetAllKeys,
  loadAllKeys,
  loadKey,
  loadPrefs,
  maskKey,
  saveKey,
  savePrefs,
} from "./settings";
import { AiError, type FetchLike, type StructuredRequest } from "./types";

const KEY = "sk-ant-test-0123456789abcdef";

const Schema = z.object({ status: z.enum(["answered", "not_answerable"]), answer: z.string() });
const REQ: StructuredRequest<z.infer<typeof Schema>> = {
  feature: "ask",
  system: "SYSTEM PROMPT",
  user: "How many tweets?",
  schema: Schema,
  schemaName: "test_answer",
};

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  get size() {
    return this.m.size;
  }
}

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function mockFetch(respond: (c: Captured) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const c: Captured = {
      url: String(input instanceof Request ? input.url : input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "{}")),
    };
    calls.push(c);
    return respond(c);
  });
  return { fetch: fetch as unknown as FetchLike, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function claudeMessage(text: string, extra: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 40 },
    ...extra,
  };
}

const GOOD = JSON.stringify({ status: "answered", answer: "2,284,909 tweets." });

describe("settings", () => {
  it("keeps the key in session storage unless asked to remember it", () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    saveKey("anthropic", `  ${KEY}  `, false, session, local);
    expect(loadKey("anthropic", session, local)).toEqual({ key: KEY, remembered: false });
    expect(local.size).toBe(0);
    saveKey("anthropic", KEY, true, session, local);
    expect(loadKey("anthropic", session, local)).toEqual({ key: KEY, remembered: true });
    expect(session.size).toBe(0);
    saveKey("openai", "sk-openai-xyz-123456", false, session, local);
    expect(Object.keys(loadAllKeys(session, local))).toEqual(["anthropic", "openai"]);
    forgetAllKeys(session, local);
    expect(loadAllKeys(session, local)).toEqual({});
    expect(session.size + local.size).toBe(0);
  });

  it("stores preferences without the key and falls back on bad values", () => {
    const local = new MemoryStorage();
    savePrefs(local, {
      provider: "openai",
      anthropicModel: "claude-sonnet-5-5",
      openaiModel: "gpt-x",
    });
    expect(loadPrefs(local)).toEqual({
      provider: "openai",
      anthropicModel: "claude-sonnet-5-5",
      openaiModel: "gpt-x",
    });
    local.setItem(
      "spartan-tweet-cruncher.ai.prefs",
      '{"anthropicModel":"made-up","openaiModel":" "}',
    );
    expect(loadPrefs(local)).toEqual(DEFAULT_PREFS);
    local.setItem("spartan-tweet-cruncher.ai.prefs", "not json");
    expect(loadPrefs(local)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.anthropicModel).toBe("claude-haiku-4-5");
  });

  it("masks keys", () => {
    expect(maskKey(KEY)).toBe("sk-ant…cdef");
    expect(maskKey("short")).toBe("•••••");
  });
});

describe("schemas", () => {
  it("makes OpenAI's schema strict", () => {
    const s = openAiJsonSchema(Schema) as {
      required: string[];
      additionalProperties: boolean;
      $schema?: string;
    };
    expect(s.required).toEqual(["status", "answer"]);
    expect(s.additionalProperties).toBe(false);
    expect(s.$schema).toBeUndefined();
    expect(
      strictJsonSchema({ type: "object", properties: { a: { type: "object", properties: {} } } }),
    ).toEqual({
      type: "object",
      properties: {
        a: { type: "object", properties: {}, required: [], additionalProperties: false },
      },
      required: ["a"],
      additionalProperties: false,
    });
  });

  it("validates replies and keeps the evidence on failure", () => {
    expect(parseStructured(Schema, GOOD, {})).toEqual({
      status: "answered",
      answer: "2,284,909 tweets.",
    });
    try {
      parseStructured(Schema, '{"status":"maybe"}', { rawText: '{"status":"maybe"}' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiError);
      expect((e as AiError).kind).toBe("invalid-output");
      expect((e as AiError).rawText).toBe('{"status":"maybe"}');
    }
    expect(() => parseStructured(Schema, "not json", {})).toThrow(/not valid JSON/);
  });
});

describe("Anthropic adapter (fetch mocked)", () => {
  it("calls the Messages API from the browser with structured output, Haiku defaults", async () => {
    const { fetch, calls } = mockFetch(() => json(claudeMessage(GOOD)));
    const res = await callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch });
    expect(res.data).toEqual({ status: "answered", answer: "2,284,909 tweets." });
    expect(res.usage).toEqual({ inputTokens: 1200, outputTokens: 40 });
    const [c] = calls;
    expect(c.url).toBe("https://api.anthropic.com/v1/messages");
    expect(c.headers.get("x-api-key")).toBe(KEY);
    expect(c.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(c.headers.get("anthropic-beta")).toBeNull();
    expect(c.body.model).toBe("claude-haiku-4-5");
    expect(c.body.messages).toEqual([{ role: "user", content: "How many tweets?" }]);
    expect(c.body.system).toEqual([
      { type: "text", text: "SYSTEM PROMPT", cache_control: { type: "ephemeral" } },
    ]);
    const oc = c.body.output_config as {
      format: { type: string; schema: Record<string, unknown> };
      effort?: string;
    };
    expect(oc.format.type).toBe("json_schema");
    expect(oc.format.schema.additionalProperties).toBe(false);
    expect(oc.effort).toBeUndefined();
    expect(c.body.fallbacks).toBeUndefined();
  });

  it("uses low effort and the server-side fallback on Sonnet 5.5", async () => {
    const { fetch, calls } = mockFetch(() =>
      json(claudeMessage(GOOD, { model: "claude-sonnet-5-5" })),
    );
    await callAnthropic(KEY, "claude-sonnet-5-5", REQ, { fetch });
    const [c] = calls;
    expect(c.url).toContain("/v1/messages");
    expect(c.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(c.body.fallbacks).toBe("default");
    expect((c.body.output_config as { effort?: string }).effort).toBe("low");
    expect(c.body.betas).toBeUndefined();
  });

  it("reports refusals and truncation before format errors, with evidence", async () => {
    const refusal = mockFetch(() =>
      json(
        claudeMessage("", {
          stop_reason: "refusal",
          stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
        }),
      ),
    );
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: refusal.fetch }),
    ).rejects.toMatchObject({
      kind: "refusal",
    });
    const cut = mockFetch(() =>
      json(claudeMessage('{"status":"answ', { stop_reason: "max_tokens" })),
    );
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: cut.fetch }),
    ).rejects.toMatchObject({
      kind: "truncated",
      rawText: '{"status":"answ',
      usage: { inputTokens: 1200, outputTokens: 40 },
    });
  });

  it("maps HTTP and network failures to readable errors", async () => {
    const err = (status: number, type: string) =>
      mockFetch(() => json({ type: "error", error: { type, message: "nope" } }, status)).fetch;
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: err(401, "authentication_error") }),
    ).rejects.toMatchObject({ kind: "invalid-key" });
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: err(429, "rate_limit_error") }),
    ).rejects.toMatchObject({ kind: "rate-limit" });
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: err(403, "permission_error") }),
    ).rejects.toMatchObject({ kind: "permission" });
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: err(529, "overloaded_error") }),
    ).rejects.toMatchObject({ kind: "overloaded" });
    const offline = mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      callAnthropic(KEY, "claude-haiku-4-5", REQ, { fetch: offline.fetch }),
    ).rejects.toMatchObject({ kind: "network" });
  });
});

describe("OpenAI adapter (fetch mocked)", () => {
  it("sends a strict JSON-schema request with the key only in the Authorization header", async () => {
    const { fetch, calls } = mockFetch(() =>
      json({
        model: "gpt-5-mini-2026",
        choices: [{ finish_reason: "stop", message: { content: GOOD } }],
        usage: { prompt_tokens: 900, completion_tokens: 30 },
      }),
    );
    const res = await callOpenAI("sk-openai-test", "gpt-5-mini", REQ, { fetch });
    expect(res.model).toBe("gpt-5-mini-2026");
    expect(res.usage).toEqual({ inputTokens: 900, outputTokens: 30 });
    const [c] = calls;
    expect(c.url).toBe(OPENAI_URL);
    expect(c.headers.get("authorization")).toBe("Bearer sk-openai-test");
    expect(JSON.stringify(c.body)).not.toContain("sk-openai-test");
    const rf = c.body.response_format as { json_schema: { strict: boolean; name: string } };
    expect(rf.json_schema).toMatchObject({ strict: true, name: "test_answer" });
  });

  it("maps errors, refusals and truncation", async () => {
    const status = (s: number) =>
      mockFetch(() => json({ error: { message: "x", code: "c" } }, s)).fetch;
    await expect(callOpenAI("k", "m", REQ, { fetch: status(401) })).rejects.toMatchObject({
      kind: "invalid-key",
    });
    await expect(callOpenAI("k", "m", REQ, { fetch: status(429) })).rejects.toMatchObject({
      kind: "rate-limit",
    });
    await expect(callOpenAI("k", "m", REQ, { fetch: status(500) })).rejects.toMatchObject({
      kind: "server",
    });
    const refusal = mockFetch(() =>
      json({ choices: [{ message: { content: null, refusal: "no" } }] }),
    );
    await expect(callOpenAI("k", "m", REQ, { fetch: refusal.fetch })).rejects.toMatchObject({
      kind: "refusal",
    });
    const cut = mockFetch(() =>
      json({ choices: [{ finish_reason: "length", message: { content: "{" } }] }),
    );
    await expect(callOpenAI("k", "m", REQ, { fetch: cut.fetch })).rejects.toMatchObject({
      kind: "truncated",
    });
    const cors = mockFetch(() => {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    });
    await expect(callOpenAI("k", "m", REQ, { fetch: cors.fetch })).rejects.toMatchObject({
      kind: "network",
    });
  });
});

describe("callStructured audit trail", () => {
  const creds = { provider: "anthropic" as const, model: "claude-haiku-4-5", apiKey: KEY };

  it("logs every call with the context hash and never the key", async () => {
    const audit = new MemoryAuditStore();
    const { fetch } = mockFetch(() =>
      json(claudeMessage(GOOD, { model: "claude-haiku-4-5-20251001" })),
    );
    let t = 100;
    const res = await callStructured(creds, REQ, {
      audit,
      fetch,
      contextHash: "abc123",
      now: () => (t += 250),
      clock: () => new Date("2026-10-06T00:00:00Z"),
    });
    const [entry] = await audit.list();
    expect(entry).toMatchObject({
      feature: "ask",
      provider: "anthropic",
      model: "claude-haiku-4-5 → claude-haiku-4-5-20251001",
      contextHash: "abc123",
      timestamp: "2026-10-06T00:00:00.000Z",
      latencyMs: 250,
      usage: { inputTokens: 1200, outputTokens: 40 },
      humanDecision: "pending",
      error: null,
      input: { system: "SYSTEM PROMPT", user: "How many tweets?", schema: "test_answer" },
    });
    expect(res.entry.id).toBe(entry.id);
    expect(JSON.stringify(entry)).not.toContain(KEY);
    expect(auditToJson([entry])).not.toContain(KEY);
    expect(auditToCsv([entry])).not.toContain(KEY);
  });

  it("logs failures too, and refuses to call without a key", async () => {
    const audit = new MemoryAuditStore();
    await expect(callStructured({ ...creds, apiKey: "  " }, REQ, { audit })).rejects.toMatchObject({
      kind: "missing-key",
    });
    const { fetch } = mockFetch(() =>
      json({ type: "error", error: { type: "authentication_error", message: "bad" } }, 401),
    );
    await expect(callStructured(creds, REQ, { audit, fetch })).rejects.toMatchObject({
      kind: "invalid-key",
    });
    const entries = await audit.list();
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.output === null && e.error !== null)).toBe(true);
    expect(entries.every((e) => e.humanDecision === "not-applicable")).toBe(true);
  });

  it("records human decisions and exports CSV with a fixed header", async () => {
    const audit = new MemoryAuditStore();
    const { fetch } = mockFetch(() => json(claudeMessage(GOOD)));
    const { entry } = await callStructured(creds, REQ, { audit, fetch });
    await audit.update(entry.id, {
      humanDecision: "edited",
      editedOutput: 'Melbourne: 2,284,909, "per T2.2"',
      decidedAt: "2026-10-06T01:00:00Z",
    });
    const [e] = (await audit.list()) as AuditEntry[];
    expect(e.humanDecision).toBe("edited");
    const csv = auditToCsv([e]);
    const [header] = csv.split("\r\n");
    expect(header).toBe(AUDIT_CSV_COLUMNS.join(","));
    expect(csv).toContain('"Melbourne: 2,284,909, ""per T2.2"""');
    await audit.clear();
    expect(await audit.list()).toEqual([]);
  });
});

describe("sha256Hex", () => {
  it("matches the known digest of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
