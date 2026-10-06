/**
 * The guided tour: recorded walkthroughs and key-feature screenshots.
 *
 * One source of truth for the step captions. The Playwright tour
 * (e2e/showcase.spec.ts) shows them as on-screen captions and writes them to
 * WebVTT files, the /tour page lists them under each video, and the README's
 * "Workflow walkthrough" repeats them (a test keeps the three in step).
 * Media are produced by `pnpm showcase`.
 */

export type WalkthroughId = "the-results" | "scaling-lab" | "mpi-in-your-browser";

export interface Walkthrough {
  id: WalkthroughId;
  title: string;
  /** Route the walkthrough starts on. */
  route: string;
  summary: string;
  /** Seeds and settings, so the recording can be reproduced by hand. */
  setup: string;
  /** On-screen captions, in order (step k is shown as "k/N"). */
  steps: readonly string[];
  /** Step numbers (1-based) whose caption shows the "mocked AI response" badge. */
  mockedSteps?: readonly number[];
}

export const MOCK_LABEL = "Mocked AI response for illustration";

/** Opens every mocked answer, so the text itself says what it is. */
export const MOCK_ANSWER_PREFIX = "Mocked response for illustration.";

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "the-results",
    title: "The results",
    route: "/results",
    summary:
      "The dashboard of the three answers the MPI program wrote on Spartan in 2023: tweets per capital city on a map, the top tweeters, the city-hoppers heatmap and the raw result files.",
    setup: "No input needed: every number is transcribed from the 2023 submission.",
    steps: [
      "Open Results: the three answers from the final Spartan run over 9,092,274 tweets",
      "Task 2: tweets per Greater Capital City, on a map of Australia and in a table",
      "Hover a city to highlight it on the map and in the table: Melbourne edges out Sydney",
      "Task 1: the ten most prolific authors, ties sharing a place",
      "Task 3: ten authors tweeted from all eight capitals; each cell is a city's share",
      "The three result files, laid out in main.py's format",
    ],
  },
  {
    id: "scaling-lab",
    title: "Scaling lab",
    route: "/scaling",
    summary:
      "The Spartan benchmark jobs, their speedup and Karp–Flatt serial fraction, and an Amdahl's law explorer fitted to the measured runs, with the serial-fraction slider dragged to ask “what if”.",
    setup:
      "Final submission's jobs 46094405–07 (1 × 1, 1 × 8 and 2 × 4 cores, one run each); the explorer starts from the least-squares fit.",
    steps: [
      "Open Scaling: the 1 × 1, 1 × 8 and 2 × 4-core Spartan jobs, one run each",
      "Speedup, efficiency and the Karp–Flatt serial fraction for every job",
      "Amdahl's law explorer: the serial fraction fitted to the 8-core runs, about 3.2%",
      "Drag the serial fraction f: the curve, the predictions and the ceiling follow",
      "Drag the workers n: predicted time and speedup at that core count",
      "Gustafson's law for contrast: the same f if the input grew with the cores",
      "Reset to the fit: one run per layout, so 3.2% is a point estimate with no interval",
    ],
  },
  {
    id: "mpi-in-your-browser",
    title: "MPI in your browser",
    route: "/lab",
    summary:
      "A seeded synthetic file crunched by the ported algorithm with one Web Worker per MPI rank, a repeated benchmark across worker counts with interval estimates, then the optional bring-your-own-key question answering, shown with a mocked reply (no real key is used).",
    setup:
      "Seed 2023, 100,000 tweets. Benchmark: 1 warm-up and 5 timed rounds per worker count, round order seed 2023, bootstrap seed 90024; worker counts 1, 3, 4, 6, 8 and 10 on the 10-core recording machine (2 is skipped: the original cannot run on 2 ranks). Ask: a placeholder key and a mocked reply.",
    steps: [
      "Open the MPI lab: one Web Worker per MPI rank, running the ported algorithm",
      "Generate the seeded synthetic file: seed 2023, 100,000 tweets in bigTwitter.json's layout",
      "Run on 1 rank first: the clean baseline, like the 1 node × 1 core job",
      "Run on 8 ranks: each scans its own byte range, then ranks 0, 1 and 2 reduce the tasks",
      "Same three result files as the 1-rank baseline; the answers from the task ranks",
      "Benchmark: 5 timed rounds per worker count after a warm-up, in shuffled order",
      "Speedup with nominal 95% bootstrap intervals, the fitted Amdahl curve and its band",
      "Per worker count: median time with an exact interval, efficiency and Karp–Flatt",
      "Ask the results: optional, answered only from the result tables, with your own key",
      "AI settings: the key stays in this browser and goes only to the provider",
      "For this demo: a placeholder key, never a real one; provider calls are intercepted",
      "A mocked answer, labelled AI-generated, with cited rows and an automatic check",
      "Accept it: the review is recorded in the AI audit log, with JSON and CSV export",
      "Forget key: the placeholder is removed from this browser",
    ],
    mockedSteps: [11, 12, 13],
  },
];

export interface Screenshot {
  /** File name without extension, e.g. "01-landing-light". */
  id: string;
  title: string;
  caption: string;
  viewport: "desktop" | "mobile";
}

export const SCREENSHOTS: readonly Screenshot[] = [
  {
    id: "01-landing-light",
    title: "Landing page",
    caption: "Nine million tweets, eight cores: the project, its answers and its speedup.",
    viewport: "desktop",
  },
  {
    id: "02-landing-dark",
    title: "Landing page, dark mode",
    caption: "The same page in dark mode.",
    viewport: "desktop",
  },
  {
    id: "03-results-map",
    title: "Results: capital cities",
    caption: "Task 2 on a map of Australia, with the per-city table.",
    viewport: "desktop",
  },
  {
    id: "04-results-authors",
    title: "Results: authors",
    caption: "Task 3's city-hoppers heatmap: each cell is a city's share of an author's tweets.",
    viewport: "desktop",
  },
  {
    id: "05-scaling-amdahl",
    title: "Scaling lab",
    caption: "Amdahl's law fitted to the Spartan jobs, with sliders for f and n.",
    viewport: "desktop",
  },
  {
    id: "06-lab-run",
    title: "MPI in your browser",
    caption: "8 Web Worker ranks over a seeded synthetic file: scan, reduce, check.",
    viewport: "desktop",
  },
  {
    id: "07-lab-benchmark",
    title: "Benchmark with intervals",
    caption: "Repeated, shuffled rounds: bootstrap CIs for speedup and the fitted f.",
    viewport: "desktop",
  },
  {
    id: "08-how-it-works",
    title: "How it works",
    caption: "Byte-range chunking on the real 18.7 GB file size, step by step.",
    viewport: "desktop",
  },
  {
    id: "09-methods",
    title: "Methods",
    caption: "Provenance, evaluation design, limitations, decision records and AI use.",
    viewport: "desktop",
  },
  {
    id: "10-ai-settings",
    title: "Bring your own key",
    caption: "AI settings: Anthropic by default, the key stays in this browser.",
    viewport: "desktop",
  },
  {
    id: "11-ask-mocked-answer",
    title: "Ask the results (mocked reply)",
    caption: "A mocked answer for illustration: cited rows, automatic check, your review.",
    viewport: "desktop",
  },
  {
    id: "12-mobile-landing",
    title: "Mobile: landing",
    caption: "The landing page at 390 px.",
    viewport: "mobile",
  },
  {
    id: "13-mobile-results",
    title: "Mobile: results",
    caption: "The Task 2 map and table on a phone.",
    viewport: "mobile",
  },
  {
    id: "14-mobile-lab",
    title: "Mobile: MPI lab",
    caption: "A run on 8 ranks, on a phone.",
    viewport: "mobile",
  },
];

/** Public paths of a walkthrough's media (files live in web/public/showcase/). */
export function walkthroughMedia(id: WalkthroughId) {
  return {
    mp4: `/showcase/${id}.mp4`,
    poster: `/showcase/${id}-poster.webp`,
    captions: `/showcase/${id}.vtt`,
  };
}

/** Public path of a screenshot's WebP copy used by /tour. */
export const screenshotSrc = (id: string) => `/showcase/screens/${id}.webp`;

/** Pixel size of the WebP copies (desktop 1440 × 900; mobile 390 × 844 at 1.5×). */
export const SCREENSHOT_SIZE = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 585, height: 1266 },
} as const;
