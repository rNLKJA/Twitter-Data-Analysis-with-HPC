/**
 * The guided tour, as an end-to-end test.
 *
 *   pnpm showcase                                   # production, records media
 *   BASE_URL=http://localhost:3000 pnpm showcase    # a local `pnpm build` first
 *   pnpm showcase:test                              # journeys only: no pauses, no video
 *
 * Each journey checks what it shows (the published numbers, the fitted serial
 * fraction, the 1-rank baseline and an identical 8-rank run, a complete
 * benchmark, the mocked answer passing the site's own grounding check, the
 * audit log entry), so a broken feature fails the tour instead of producing a
 * misleading video. Inputs are fixed: the lab uses its default seed 2023 and
 * 100,000 tweets, and the benchmark its fixed order and bootstrap seeds.
 * Timings are measured live, so they vary from run to run.
 *
 * No real API key is used: the AI steps type a placeholder, and every request
 * to a provider is answered in the browser by e2e/mock-ai.ts.
 */
import path from "node:path";

import {
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  expect,
  test,
} from "@playwright/test";

import { MOCK_LABEL, SCREENSHOTS, WALKTHROUGHS, type WalkthroughId } from "../src/lib/showcase";
import { MOCK_QUESTION, PLACEHOLDER_KEY, mockAiProviders } from "./mock-ai";
import {
  FAST,
  SHOT_DIR,
  Tour,
  ensureDirs,
  finishRecording,
  recordingContext,
} from "./showcase-helpers";

const walkthrough = (id: WalkthroughId) => WALKTHROUGHS.find((w) => w.id === id)!;

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * Viewport screenshot to .showcase/screens/<id>.png, optionally with `align`
 * scrolled to `offset` px from the top (applied twice, after layout settles).
 */
async function shot(page: Page, id: string, align?: { target: Locator; offset: number }) {
  if (!SCREENSHOTS.some((s) => s.id === id)) throw new Error(`Unknown screenshot ${id}`);
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  for (let i = 0; i < 2; i++) {
    if (align) {
      await align.target.evaluate((el, offset) => {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "instant" });
      }, align.offset);
    }
    await page.waitForTimeout(450);
  }
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`) });
}

/** A visible "mocked" label pinned to the page, for screenshots of mocked AI output. */
async function pinMockLabel(page: Page) {
  await page.evaluate((label) => {
    const el = document.createElement("div");
    el.textContent = label;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;right:24px;bottom:24px;z-index:2147483647;padding:8px 14px;border-radius:12px;" +
      "background:#fff3d6;color:#5a3b00;border:2px dashed #b07a00;font:700 15px/1.2 ui-sans-serif,system-ui,sans-serif;" +
      "text-transform:uppercase;letter-spacing:.04em;box-shadow:0 8px 24px rgba(0,0,0,.18)";
    document.body.appendChild(el);
  }, MOCK_LABEL);
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

// ------------------------------------------------------------------ the lab

const lab = {
  generate: (page: Page) => page.getByRole("button", { name: "Generate synthetic file" }),
  rank: (page: Page, n: number) =>
    page.getByRole("radio", { name: `${n} rank${n === 1 ? "" : "s"}`, exact: true }),
  runOnce: (page: Page, n: number) =>
    page.getByRole("button", { name: `Run once on ${n} rank${n === 1 ? "" : "s"}` }),
  monitor: (page: Page) => page.locator("section").filter({ has: page.locator("#monitor-title") }),
  bench: (page: Page) => page.locator("section").filter({ has: page.locator("#bench-title") }),
};

async function generateFile(page: Page) {
  await expect(page.getByText("synthetic-2023-100000.json")).toBeVisible({ timeout: 60_000 });
  await expect(lab.runOnce(page, 8)).toBeEnabled({ timeout: 60_000 });
}

async function runOnce(page: Page, n: number) {
  await expect(lab.runOnce(page, n)).toBeEnabled();
  await lab.runOnce(page, n).click();
}

async function expectRunFinished(page: Page, id: number) {
  await expect(lab.monitor(page).getByText(`Run #${id} finished.`)).toBeVisible({
    timeout: 120_000,
  });
}

const benchDone = (page: Page) =>
  expect(lab.bench(page).getByText(/^B\d+: 5 complete rounds × \d+ worker counts\.$/)).toBeVisible({
    timeout: 300_000,
  });

// ------------------------------------------------------------- ask the results

async function addPlaceholderKey(
  page: Page,
  type: (target: Locator, text: string) => Promise<void>,
) {
  const dialog = page.getByRole("dialog", { name: "AI settings" });
  await expect(dialog).toBeVisible();
  await type(dialog.getByLabel("Anthropic API key"), PLACEHOLDER_KEY);
  return dialog;
}

const answerCard = (page: Page) =>
  page.getByRole("article", { name: `Answer to: ${MOCK_QUESTION}` });

async function expectMockedAnswer(page: Page) {
  const card = answerCard(page);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("AI-generated")).toBeVisible();
  await expect(card).toContainText("Mocked response for illustration.");
  await expect(card).toContainText("Answered from the tables");
  await expect(card).toContainText("T2.2");
  // The site's own grounding check passes on the mocked answer.
  await expect(card).toContainText("Automatic check: every cited row exists");
  return card;
}

test.beforeAll(() => ensureDirs());

test.describe("journeys (recorded)", () => {
  test("1. the results: map, top tweeters, city-hoppers, raw files", async ({ browser }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("the-results"));

    await page.goto("/results");
    await expect(h1(page)).toContainText("9 million tweets");
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1200);
    await tour.hover(page.getByText("9,092,274").first(), 900);
    await tour.pause(1600);

    await tour.caption(2);
    await tour.scrollTo(page.locator("#task2"), { offset: 76, ms: 1300 });
    await tour.pause(1400);

    await tour.caption(3);
    const city = (name: string) => page.getByRole("img", { name: new RegExp(`^${name}: `) });
    await expect(city("Greater Melbourne")).toHaveAccessibleName(
      "Greater Melbourne: 2,284,909 tweets",
    );
    await expect(city("Greater Sydney")).toHaveAccessibleName("Greater Sydney: 2,218,689 tweets");
    await tour.hover(city("Greater Melbourne"), 900);
    await tour.pause(1600);
    await tour.hover(city("Greater Sydney"), 700);
    await tour.pause(1600);
    await tour.hover(city("Greater Brisbane"), 700);
    await tour.pause(1200);
    await tour.hover(page.getByRole("rowheader", { name: /^Perth/ }), 900);
    await tour.pause(1400);

    await tour.caption(4);
    await tour.scrollTo(page.locator("#task1"), { offset: 90, ms: 1300 });
    const top = page
      .getByRole("table", { name: /^Top 10 authors by number of tweets/ })
      .getByRole("cell", { name: "68,477" });
    await expect(top).toBeVisible();
    await tour.hover(top, 800);
    await tour.pause(2200);

    await tour.caption(5);
    await tour.scrollTo(page.locator("#task3"), { offset: 80, ms: 1300 });
    const heatmap = page.getByRole("table", { name: /^Top 10 authors by number of distinct/ });
    await expect(heatmap.locator("tbody").getByRole("row")).toHaveCount(10);
    await tour.hover(heatmap.getByRole("rowheader").first(), 800);
    await tour.pause(1000);
    await tour.hover(heatmap.getByRole("cell").nth(3), 700);
    await tour.pause(1600);

    await tour.caption(6);
    await tour.scrollTo(page.locator("#raw"), { offset: 90, ms: 1300 });
    await tour.click(page.getByRole("tab", { name: "task2.csv" }));
    await expect(page.getByRole("tabpanel")).toContainText("2284909");
    await tour.pause(1400);
    await tour.click(page.getByRole("tab", { name: "task3.csv" }));
    await tour.pause(2000);

    await finishRecording(context, page, tour);
  });

  test("2. scaling lab: benchmark jobs and the Amdahl explorer", async ({ browser }) => {
    const context = await recordingContext(browser);
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("scaling-lab"));
    const fThumb = page.getByRole("slider", { name: "Serial fraction" });
    const fTrack = page.locator("#f-slider [data-slot=slider-track]");
    const nThumb = page.getByRole("slider", { name: "Number of workers" });
    const nTrack = page.locator("#n-slider [data-slot=slider-track]");

    await page.goto("/scaling");
    await expect(h1(page)).toContainText("Eight cores");
    await settle(page);
    tour.markStart();

    await tour.caption(1);
    await tour.pause(1200);
    await tour.hover(page.getByText("6.54×").first(), 900);
    await tour.pause(1600);

    await tour.caption(2);
    const finalTable = page.getByRole("table", { name: "Final benchmark jobs on Spartan" });
    await tour.scrollTo(page.locator("#runs"), { offset: 80, ms: 1200 });
    await tour.hover(finalTable, 800);
    await tour.pause(2200);

    await tour.caption(3);
    await tour.scrollTo(page.getByRole("heading", { name: "Amdahl's law explorer" }), {
      offset: 76,
      ms: 1300,
    });
    await expect(fThumb).toHaveAttribute("aria-valuetext", "3.18%");
    await tour.hover(page.getByText("Fitted:").first(), 800);
    await tour.pause(1800);

    await tour.caption(4);
    await tour.dragSlider(fThumb, fTrack, [0.5, 0.05, 0.25]);
    await expect(page.getByRole("button", { name: "Reset to fit" })).toBeEnabled();
    await tour.pause(1200);

    await tour.caption(5);
    await tour.dragSlider(nThumb, nTrack, [1, 7 / 31]);
    await expect(nThumb).toHaveAttribute("aria-valuenow", "8");
    await tour.pause(1200);

    await tour.caption(6);
    await tour.click(page.getByRole("button", { name: "Gustafson's law" }));
    await expect(page.getByRole("button", { name: "Gustafson's law" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await tour.pause(2400);

    await tour.caption(7);
    await tour.click(page.getByRole("button", { name: "Reset to fit" }));
    await expect(fThumb).toHaveAttribute("aria-valuetext", "3.18%");
    await tour.pause(1000);
    await tour.scrollTo(page.locator("#certainty"), { offset: 260, ms: 1300 });
    await tour.hover(page.locator("#certainty"), 800);
    await tour.pause(2600);

    await finishRecording(context, page, tour);
  });

  test("3. MPI in your browser, then ask the results (mocked AI response)", async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const context = await recordingContext(browser);
    const ai = await mockAiProviders(context, { latencyMs: FAST ? 150 : 1200 });
    const page = await context.newPage();
    const tour = new Tour(page, walkthrough("mpi-in-your-browser"));

    await page.goto("/lab");
    await expect(h1(page)).toContainText("Run the 2023 pipeline");
    await expect(page.getByText(/place keys/)).toBeVisible({ timeout: 30_000 });
    await settle(page);
    tour.markStart();

    // On a wide screen the lab's controls are a sticky column that scrolls on
    // its own (it is taller than the 800 px window); captions go on the right.
    const right = { align: "right" } as const;
    const fixed = { scroll: false } as const;
    const controls = page.getByRole("region", { name: "Input and run controls" });
    const ranksPanel = controls.locator("section").filter({ has: page.locator("#ranks-title") });

    await tour.caption(1, right);
    await tour.pause(1000);
    await tour.hover(page.getByText("Each Web Worker plays one MPI rank."), 900);
    await tour.pause(2200);

    await tour.caption(2, right);
    // Bring the rank monitor to the top; the controls column then sticks below the header.
    await tour.scrollTo(lab.monitor(page), { offset: 80, ms: 900 });
    await expect(page.getByRole("spinbutton", { name: "Seed" })).toHaveValue("2023");
    await tour.hover(page.getByRole("spinbutton", { name: "Seed" }), 800, fixed);
    await tour.pause(900);
    await tour.hover(page.getByRole("radio", { name: /^100,000 tweets/ }), 600, fixed);
    await tour.pause(700);
    await tour.click(lab.generate(page), { ...fixed, after: 0 });
    await tour.idleWhile(() => generateFile(page));
    await tour.pause(600);

    await tour.caption(3, right);
    await tour.scrollInside(controls, ranksPanel, { offset: 0, ms: 900 });
    await tour.click(lab.rank(page, 1), fixed);
    await tour.hover(lab.runOnce(page, 1), 600, fixed);
    await tour.click(lab.runOnce(page, 1), { ...fixed, after: 0 });
    await tour.idleWhile(() => expectRunFinished(page, 1));
    const baseline = lab
      .monitor(page)
      .getByText(/it is the baseline the other runs on this file are checked/);
    await expect(baseline).toBeVisible();
    await tour.hover(baseline, 800);
    await tour.pause(2000);

    await tour.caption(4, right);
    await tour.click(lab.rank(page, 8), fixed);
    await tour.hover(lab.runOnce(page, 8), 600, fixed);
    await tour.click(lab.runOnce(page, 8), { ...fixed, after: 0 });
    await tour.idleWhile(() => expectRunFinished(page, 2));
    await tour.tryHover(lab.monitor(page).getByText("rank 0", { exact: true }), 700);
    await tour.pause(900);
    await tour.tryHover(lab.monitor(page).getByText("rank 7", { exact: true }), 900);
    await tour.pause(1600);

    await tour.caption(5, right);
    const identical = lab
      .monitor(page)
      .getByText("All three result files are identical to run #1's");
    await expect(identical).toBeVisible();
    await tour.hover(identical, 700);
    await tour.pause(1600);
    const answers = page.locator("section").filter({ has: page.locator("#answers-title") });
    await tour.scrollTo(answers, { offset: 90, ms: 1000 });
    await tour.click(answers.getByRole("tab", { name: "Task 2" }));
    await expect(answers.getByText("Melbourne")).toBeVisible();
    await tour.pause(1800);

    await tour.caption(6, right);
    await tour.scrollTo(page.locator("#bench-title"), { offset: 76, ms: 900 });
    const benchSettings = controls.getByText("Benchmark", { exact: true });
    await tour.scrollInside(controls, benchSettings, { offset: 16, ms: 900 });
    await tour.click(page.getByRole("radio", { name: "5 timed rounds", exact: true }), fixed);
    await expect(page.getByText(/^n = 1, 3, 4/)).toBeVisible();
    await tour.hover(page.getByText(/^n = 1, 3, 4/), 700, fixed);
    await tour.pause(1400);
    await tour.click(page.getByRole("button", { name: "Run benchmark" }), { ...fixed, after: 0 });
    await tour.idleWhile(() => benchDone(page));
    await tour.pause(600);

    await tour.caption(7, right);
    await tour.scrollTo(lab.bench(page), { offset: 72, ms: 900 });
    await tour.hover(lab.bench(page).getByText(/^Best speedup/), 800);
    await tour.pause(1600);
    await tour.hover(lab.bench(page).getByText("Serial fraction f", { exact: true }), 700);
    await tour.pause(1400);
    await tour.hover(lab.bench(page).getByText("Speedup over 1 rank"), 700);
    await tour.pause(1400);

    await tour.caption(8, right);
    const table = lab.bench(page).getByRole("region", {
      name: "Benchmark results by number of ranks, scrollable",
    });
    await tour.scrollTo(table, { offset: 120, ms: 1100 });
    // One row per worker count (1, 3, 4, ... up to the machine's cores, at most 16).
    expect(await table.locator("tbody").getByRole("row").count()).toBeGreaterThanOrEqual(3);
    await tour.hover(table, 800);
    await tour.pause(2600);

    await tour.caption(9);
    await tour.scrollTo(page.locator("body"), { offset: 0, ms: 900 });
    await tour.click(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Ask AI" }),
    );
    await expect(page).toHaveURL(/\/ask$/);
    await expect(h1(page)).toHaveText("Ask the results");
    await settle(page);
    await tour.hover(page.getByText("What the model sees"), 800);
    await tour.pause(1800);

    await tour.caption(10);
    await tour.click(page.getByRole("button", { name: "Add a key", exact: true }));
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await tour.pause(900);
    await tour.hover(dialog.getByText("Your key stays in this browser."), 800);
    await tour.pause(2000);
    await tour.hover(dialog.getByRole("radio", { name: /Claude Haiku 4\.5/ }), 700);
    await tour.pause(1200);

    await tour.caption(11);
    await addPlaceholderKey(page, (t, s) => tour.type(t, s));
    await tour.pause(700);
    await tour.click(dialog.getByRole("button", { name: "Save" }));
    await expect(dialog).toBeHidden();

    await tour.caption(12);
    await tour.click(page.getByRole("button", { name: MOCK_QUESTION }));
    await expect(page.getByLabel("Your question")).toHaveValue(MOCK_QUESTION);
    await tour.click(page.getByRole("button", { name: "Ask", exact: true }), { after: 0 });
    const card = await expectMockedAnswer(page);
    await tour.scrollTo(card, { offset: 90, ms: 900 });
    await tour.hover(card.getByText("AI-generated"), 700);
    await tour.pause(1600);
    await tour.hover(card.getByText(/^Cited rows/), 700);
    await tour.pause(1600);
    await tour.hover(card.getByText(/^Automatic check/), 700);
    await tour.pause(2000);

    await tour.caption(13);
    await tour.click(card.getByRole("button", { name: "Accept" }));
    await expect(card.getByText("recorded: accepted")).toBeVisible();
    await tour.pause(1000);
    await tour.click(page.locator("#main").getByRole("link", { name: "AI audit log" }));
    await expect(page).toHaveURL(/\/ai-log$/);
    await expect(
      page.getByText(/^1 call logged in this browser: 0 failed, 1 reviewed by you\.$/),
    ).toBeVisible();
    await tour.pause(1400);
    await tour.hover(page.getByRole("button", { name: "CSV" }), 700);
    await tour.pause(1800);

    await tour.caption(14);
    await tour.click(page.getByRole("button", { name: /^AI settings/ }));
    await tour.click(page.getByRole("dialog").getByRole("button", { name: /^Forget/ }));
    await expect(page.getByText("No Anthropic key saved.")).toBeVisible();
    await tour.pause(2200);
    await page.keyboard.press("Escape");
    await tour.pause(800);

    expect(ai.calls).toBe(1);
    expect(ai.leaks, "the placeholder key must only go to the (mocked) provider").toEqual([]);
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain(PLACEHOLDER_KEY);

    await finishRecording(context, page, tour);
  });
});

async function desktop(browser: Browser, colorScheme: "light" | "dark" = "light") {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme,
  });
}

async function mobile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
}

test.describe("screenshots", () => {
  test("landing, light and dark", async ({ browser }) => {
    for (const scheme of ["light", "dark"] as const) {
      const context = await desktop(browser, scheme);
      const page = await context.newPage();
      await page.goto("/");
      await expect(h1(page)).toContainText("Nine million tweets");
      await settle(page);
      await shot(page, `0${scheme === "light" ? 1 : 2}-landing-${scheme}`);
      await context.close();
    }
  });

  test("key features at 1440 × 900", async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const context = await desktop(browser);
    await mockAiProviders(context, { latencyMs: 0 });
    const page = await context.newPage();

    await page.goto("/results");
    await settle(page);
    await shot(page, "03-results-map", { target: page.locator("#task2"), offset: 88 });
    await shot(page, "04-results-authors", { target: page.locator("#task3"), offset: 88 });

    await page.goto("/scaling");
    await settle(page);
    await page.getByRole("button", { name: "Gustafson's law" }).click();
    await shot(page, "05-scaling-amdahl", { target: page.locator("#explore"), offset: 80 });

    await page.goto("/lab");
    await settle(page);
    await lab.generate(page).click();
    await generateFile(page);
    await lab.rank(page, 1).click();
    await runOnce(page, 1);
    await expectRunFinished(page, 1);
    await lab.rank(page, 8).click();
    await runOnce(page, 8);
    await expectRunFinished(page, 2);
    await expect(
      lab.monitor(page).getByText("All three result files are identical to run #1's"),
    ).toBeVisible();
    await shot(page, "06-lab-run", { target: h1(page), offset: 96 });
    await page.getByRole("radio", { name: "5 timed rounds", exact: true }).click();
    await page.getByRole("button", { name: "Run benchmark" }).click();
    await benchDone(page);
    await shot(page, "07-lab-benchmark", { target: page.locator("#bench-title"), offset: 84 });

    await page.goto("/how-it-works");
    await settle(page);
    await shot(page, "08-how-it-works", { target: page.locator("#split"), offset: 84 });

    await page.goto("/methods");
    await settle(page);
    await shot(page, "09-methods");

    await page.goto("/ask");
    await settle(page);
    await page.getByRole("button", { name: "Add a key", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, "10-ai-settings");
    await addPlaceholderKey(page, async (t, s) => t.fill(s));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: MOCK_QUESTION }).click();
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expectMockedAnswer(page);
    await pinMockLabel(page);
    await shot(page, "11-ask-mocked-answer", { target: page.locator("#ask-title"), offset: 84 });
    await context.close();
  });

  test("mobile at 390 × 844", async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    const context = await mobile(browser);
    const page = await context.newPage();

    await page.goto("/");
    await settle(page);
    await shot(page, "12-mobile-landing");

    await page.goto("/results");
    await settle(page);
    // #task2 is the heading; leave room above it for its eyebrow under the sticky header.
    await shot(page, "13-mobile-results", { target: page.locator("#task2"), offset: 104 });

    await page.goto("/lab");
    await settle(page);
    await lab.generate(page).click();
    await generateFile(page);
    await runOnce(page, 8);
    await expectRunFinished(page, 1);
    await shot(page, "14-mobile-lab", { target: page.locator("#monitor-title"), offset: 72 });
    await context.close();
  });
});
