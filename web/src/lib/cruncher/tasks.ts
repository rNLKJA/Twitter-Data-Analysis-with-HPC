import { RURAL_GCC } from "./constants";
import type { TweetFrame } from "./processor";

/**
 * Ports of the per-rank aggregations and the task-rank reductions in
 * coursework/scripts/twitter_processor.py. Author ids are canonical decimal
 * strings; they are compared numerically, as the original int64 column is.
 */

export type AuthorCount = readonly [authorId: string, count: number];
export type GccCount = readonly [gcc: string, count: number];
export type AuthorGccCount = readonly [authorId: string, gcc: string, count: number];

/** Numeric comparison of non-negative canonical integer strings. */
export function compareIntStrings(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

const isCityGcc = (g: string | null): g is string => g !== null && !RURAL_GCC.test(g);

// ───────────────────────────── rank-local stage ─────────────────────────────

/** `count_number_of_tweets_by_author`: groupby author_id → count, sorted desc. */
export function countNumberOfTweetsByAuthor(frame: TweetFrame): AuthorCount[] {
  const counts = new Map<string, number>();
  for (const a of frame.authorId) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]);
}

/** `count_number_of_tweets_by_gcc`: drop null + rural, groupby gcc → count. */
export function countNumberOfTweetsByGcc(frame: TweetFrame): GccCount[] {
  const counts = new Map<string, number>();
  for (const g of frame.gcc) if (isCityGcc(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()];
}

/** `count_author_tweets_from_most_different_gcc`: groupby [author_id, gcc] → count. */
export function countAuthorTweetsFromMostDifferentGcc(frame: TweetFrame): AuthorGccCount[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < frame.gcc.length; i++) {
    const g = frame.gcc[i];
    if (!isCityGcc(g)) continue;
    const key = `${frame.authorId[i]}\u0000${g}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([k, n]) => {
    const [author, g] = k.split("\u0000");
    return [author, g, n] as const;
  });
}

export interface RankPartials {
  t1: AuthorCount[];
  t2: GccCount[];
  t3: AuthorGccCount[];
}

export function rankPartials(frame: TweetFrame): RankPartials {
  return {
    t1: countNumberOfTweetsByAuthor(frame),
    t2: countNumberOfTweetsByGcc(frame),
    t3: countAuthorTweetsFromMostDifferentGcc(frame),
  };
}

// ───────────────────────────── task-rank reductions ─────────────────────────

export interface Task1Row {
  rank: number;
  authorId: string;
  tweets: number;
}

/**
 * `return_twitter_counts_by_author_id` → `calculate_rank(method="min")` →
 * `return_author_with_most_tweets(top=10)`:
 * sum counts per author, rank with "min" (ties share the best rank), keep
 * rank <= 10 (so ties can yield more than ten rows), sort by rank, count,
 * author_id ascending.
 */
export function reduceTask1(
  partials: ReadonlyArray<ReadonlyArray<AuthorCount>>,
  top = 10,
): Task1Row[] {
  const totals = new Map<string, number>();
  for (const part of partials) for (const [a, n] of part) totals.set(a, (totals.get(a) ?? 0) + n);

  const sortedCounts = [...totals.values()].sort((a, b) => b - a);
  // min-rank of value v = 1 + number of values strictly greater than v
  const minRank = new Map<number, number>();
  sortedCounts.forEach((v, i) => {
    if (!minRank.has(v)) minRank.set(v, i + 1);
  });

  return [...totals.entries()]
    .map(([authorId, tweets]) => ({ rank: minRank.get(tweets)!, authorId, tweets }))
    .filter((r) => r.rank <= top)
    .sort(
      (a, b) => a.rank - b.rank || a.tweets - b.tweets || compareIntStrings(a.authorId, b.authorId),
    );
}

export interface Task2Row {
  gcc: string;
  tweets: number;
}

/** Task 2 rank: `combine_tdf(t2).groupby("gcc").sum()` then `return_gcc_with_tweets_count` (sort by gcc). */
export function reduceTask2(partials: ReadonlyArray<ReadonlyArray<GccCount>>): Task2Row[] {
  const totals = new Map<string, number>();
  for (const part of partials) for (const [g, n] of part) totals.set(g, (totals.get(g) ?? 0) + n);
  return [...totals.entries()]
    .map(([gcc, tweets]) => ({ gcc, tweets }))
    .sort((a, b) => (a.gcc < b.gcc ? -1 : a.gcc > b.gcc ? 1 : 0));
}

export interface Task3Row {
  rank: number;
  authorId: string;
  gccCount: number;
  tweets: number;
  /** Per-city counts in the order the original prints them (tweet count desc). */
  breakdown: Array<{ gcc: string; tweets: number }>;
  /** The original CSV cell, e.g. `8 (#1920 tweets - #1879gmel, #13acte, …)`. */
  text: string;
}

export interface Task3Result {
  rows: Task3Row[];
  /** `task3_1.csv`: (author_id, gcc, tweet_count) for the top authors. */
  detail: AuthorGccCount[];
}

/**
 * `generate_task_3_result` (Task 3 rank), fed with the *concatenated* per-rank
 * (author, gcc, count) frames:
 *
 * - per author: n_unique(gcc) and sum(tweet_count);
 * - sort by gcc_count desc, tweet_count desc, author_id asc;
 * - ordinal rank on gcc_count (descending, ties in row order) and keep rank < 11;
 * - re-aggregate (author, gcc) for those authors, sort by tweet_count desc,
 *   author_id desc, and format `#{n}{gcc[1:]}` joined by ", ".
 *
 * The original leaves the order of a single author's equal-count cities to
 * polars' hash grouping; here ties fall back to the gcc code so output is
 * deterministic.
 */
export function reduceTask3(partials: ReadonlyArray<ReadonlyArray<AuthorGccCount>>): Task3Result {
  const perAuthor = new Map<string, { gccs: Set<string>; tweets: number }>();
  const perPair = new Map<string, Map<string, number>>();
  for (const part of partials) {
    for (const [a, g, n] of part) {
      let agg = perAuthor.get(a);
      if (!agg) perAuthor.set(a, (agg = { gccs: new Set(), tweets: 0 }));
      agg.gccs.add(g);
      agg.tweets += n;
      let pairs = perPair.get(a);
      if (!pairs) perPair.set(a, (pairs = new Map()));
      pairs.set(g, (pairs.get(g) ?? 0) + n);
    }
  }

  const ranked = [...perAuthor.entries()]
    .map(([authorId, v]) => ({ authorId, gccCount: v.gccs.size, tweets: v.tweets }))
    .sort(
      (a, b) =>
        b.gccCount - a.gccCount || b.tweets - a.tweets || compareIntStrings(a.authorId, b.authorId),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => r.rank < 11);

  const detail: AuthorGccCount[] = [];
  for (const r of ranked) {
    for (const [g, n] of perPair.get(r.authorId)!) detail.push([r.authorId, g, n]);
  }
  detail.sort(
    (x, y) =>
      y[2] - x[2] || compareIntStrings(y[0], x[0]) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0),
  );

  const breakdowns = new Map<string, Array<{ gcc: string; tweets: number }>>();
  for (const [a, g, n] of detail) {
    let list = breakdowns.get(a);
    if (!list) breakdowns.set(a, (list = []));
    list.push({ gcc: g, tweets: n });
  }

  const rows = ranked.map((r) => {
    const breakdown = breakdowns.get(r.authorId) ?? [];
    const nugt = breakdown.map((b) => `#${b.tweets}${b.gcc.slice(1)}`).join(", ");
    return {
      rank: r.rank,
      authorId: r.authorId,
      gccCount: r.gccCount,
      tweets: r.tweets,
      breakdown,
      text: `${r.gccCount} (#${r.tweets} tweets - ${nugt})`,
    };
  });

  return { rows, detail };
}

// ───────────────────────────── CSV views (as written by the original) ───────

export function task1Csv(rows: readonly Task1Row[]): string[][] {
  return [
    ["Rank", "Author Id", "Number of Tweets Made"],
    ...rows.map((r) => [`#${r.rank}`, r.authorId, String(r.tweets)]),
  ];
}

export function task2Csv(rows: readonly Task2Row[]): string[][] {
  return [
    ["Greater Captical City", "Number of Tweets Made"],
    ...rows.map((r) => [r.gcc, String(r.tweets)]),
  ];
}

export function task3Csv(rows: readonly Task3Row[]): string[][] {
  return [
    ["Rank", "Author Id", "Number of Unique City Locations and #Tweets"],
    ...rows.map((r) => [String(r.rank), r.authorId, r.text]),
  ];
}

export function task31Csv(detail: readonly AuthorGccCount[]): string[][] {
  return [["author_id", "gcc", "tweet_count"], ...detail.map(([a, g, n]) => [a, g, String(n)])];
}
