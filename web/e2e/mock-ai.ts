/**
 * A mocked AI provider for the tour. No real key is ever used: the "key" is
 * a placeholder typed into the bring-your-own-key dialog, every request to a
 * provider is intercepted in the browser context, and the reply is written
 * here.
 *
 * The mocked answer to the example question is grounded in the published
 * Task 2 rows (T2.2 Greater Melbourne, T2.1 Greater Sydney) so the site's own
 * checks pass, and its text starts with MOCK_ANSWER_PREFIX, so nothing in the
 * recording can be mistaken for a real model's output. It reports zero
 * tokens: the mock has no usage to report.
 */
import type { BrowserContext, Request } from "@playwright/test";

import { MOCK_ANSWER_PREFIX } from "../src/lib/showcase";

/** Not a credential: an obviously fake placeholder typed into the BYOK dialog. */
export const PLACEHOLDER_KEY = "placeholder-not-a-real-key";

/** The example question the tour asks (one of the page's suggestion chips). */
export const MOCK_QUESTION = "Which capital city had the most tweets, and by how much did it lead?";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function mockAnswer(question: string) {
  if (/capital city/i.test(question)) {
    return {
      status: "answered",
      answer: `${MOCK_ANSWER_PREFIX} Greater Melbourne had the most tweets, 2,284,909, ahead of Greater Sydney with 2,218,689: a lead of 66,220 tweets.`,
      citations: ["T2.2", "T2.1"],
      calculation: "2284909 - 2218689 = 66220",
    };
  }
  return {
    status: "not_answerable",
    answer: `${MOCK_ANSWER_PREFIX} The mock only answers the tour's example question.`,
    citations: [],
    calculation: "",
  };
}

export interface MockAi {
  /** Requests that reached the mock (each one an AI call the app made). */
  calls: number;
  /** Requests to anything else that carried the placeholder key (must stay empty). */
  leaks: string[];
}

export async function mockAiProviders(
  context: BrowserContext,
  { latencyMs = 900 }: { latencyMs?: number } = {},
): Promise<MockAi> {
  const state: MockAi = { calls: 0, leaks: [] };

  await context.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    state.calls += 1;
    const body = JSON.parse(req.postData() ?? "{}") as {
      model?: string;
      messages?: { role: string; content: string }[];
    };
    const question = body.messages?.find((m) => m.role === "user")?.content ?? "";
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: `msg_mock_${state.calls}`,
        type: "message",
        role: "assistant",
        model: body.model ?? "unknown",
        content: [{ type: "text", text: JSON.stringify(mockAnswer(question)) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    });
  });

  // The tour never uses OpenAI; block it so nothing can leave the browser.
  await context.route("https://api.openai.com/**", (route) => route.abort("blockedbyclient"));

  context.on("request", (req: Request) => {
    if (req.url().startsWith("https://api.anthropic.com/")) return;
    const headers = JSON.stringify(req.headers());
    const data = req.postData() ?? "";
    if (
      headers.includes(PLACEHOLDER_KEY) ||
      data.includes(PLACEHOLDER_KEY) ||
      req.url().includes(PLACEHOLDER_KEY)
    ) {
      state.leaks.push(req.url());
    }
  });

  return state;
}
