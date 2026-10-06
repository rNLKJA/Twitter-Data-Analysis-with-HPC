import {
  task1Csv,
  task2Csv,
  task31Csv,
  task3Csv,
  type Task1Row,
  type Task2Row,
  type Task3Result,
} from "../cruncher/tasks";

/**
 * Book-keeping for the browser MPI lab: comparing task outputs between runs.
 * (Timing statistics live in ./benchmark.ts.)
 */

export interface TaskResults {
  task1: Task1Row[];
  task2: Task2Row[];
  task3: Task3Result;
}

/**
 * Canonical fingerprint of the three result files, as main.py would write
 * them. Task 3 city segments with equal counts are sorted first because the
 * original leaves their order to polars' hash group-by.
 */
export function resultsFingerprint(r: TaskResults): string {
  const t3 = task3Csv(r.task3.rows).map((row, i) => {
    if (i === 0) return row.join("|");
    const m = /^(\d+) \(#(\d+) tweets - (.*)\)$/.exec(row[2]);
    if (!m) return row.join("|");
    const segs = m[3]
      .split(", ")
      .map((s) => /^#(\d+)(.*)$/.exec(s)!)
      .map(([, n, g]) => ({ n: Number(n), g }))
      .sort((a, b) => b.n - a.n || (a.g < b.g ? -1 : a.g > b.g ? 1 : 0));
    return [
      row[0],
      row[1],
      `${m[1]} (#${m[2]} tweets - ${segs.map((s) => `#${s.n}${s.g}`).join(", ")})`,
    ].join("|");
  });
  const t31 = task31Csv(r.task3.detail)
    .slice(1)
    .map((row) => row.join("|"))
    .sort();
  return [
    ...task1Csv(r.task1).map((row) => row.join("|")),
    "--",
    ...task2Csv(r.task2).map((row) => row.join("|")),
    "--",
    ...t3,
    "--",
    ...t31,
  ].join("\n");
}

/**
 * Which runs are comparable: the same input file AND the same place
 * dictionary (a different sal.json legitimately changes Tasks 2 and 3).
 */
export function runKey(fileId: string, dict: DictIdentity): string {
  return `${fileId}|${dict.source}:${dict.name}:${dict.hash}`;
}

export interface DictIdentity {
  source: string;
  name: string;
  /** dictHash(entries), computed once when the dictionary loads. */
  hash: string;
}

/** FNV-1a over the dictionary's entries in order: cheap, and enough to tell two sal.json files apart. */
export function dictHash(entries: ReadonlyArray<readonly [string, string]>): string {
  let h = 0x811c9dc5;
  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const [k, v] of entries) {
    mix(k);
    mix("\u0000");
    mix(v);
    mix("\u0001");
  }
  return `${entries.length}-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export interface RunRecord {
  id: number;
  /** runKey(file, dictionary): only runs with the same key are compared or fitted together. */
  key: string;
  size: number;
  wallMs: number;
  /** Slowest rank's scan time: the parallel part. */
  scanMs: number;
  fingerprint: string;
  /** Chunk boundaries that made two ranks count the same tweet (see cruncher/boundary.ts). */
  doubleCounts: number;
  /** Set when the run was part of a benchmark (see ./benchmark.ts). */
  bench?: BenchTag;
}

export interface BenchTag {
  /** Benchmark id within the session. */
  id: number;
  /** Warm-up rounds are negative, timed rounds 0..R-1. */
  round: number;
  warmup: boolean;
}

/**
 * The run every other run with the same key is checked against: the first
 * one with no double-counted tweet. (A 1-rank run never double-counts, so
 * running 1 rank always yields a baseline.) Using simply the first run would
 * make a run that hit the boundary quirk the reference and flag the correct
 * runs after it as different.
 */
export function cleanBaseline(history: readonly RunRecord[], key: string): RunRecord | undefined {
  return history.find((h) => h.key === key && h.doubleCounts === 0);
}

export type OutputCheck =
  /** This run is the clean baseline. */
  | { kind: "baseline" }
  /** Same three result files as the baseline. */
  | { kind: "identical"; baselineId: number }
  /** Different, and fully explained by this run's own double-counted tweets. */
  | { kind: "quirk"; baselineId: number | null; extra: number }
  /** Different with no double count to explain it: a real discrepancy. */
  | { kind: "differs"; baselineId: number };

/** How `run`'s output compares with the clean baseline for its key. */
export function checkOutput(run: RunRecord, history: readonly RunRecord[]): OutputCheck {
  const baseline = cleanBaseline(history, run.key);
  if (!baseline) {
    // No clean run yet. A run that double-counted cannot be one; anything else
    // would itself be the baseline once it is in the history.
    return run.doubleCounts > 0
      ? { kind: "quirk", baselineId: null, extra: run.doubleCounts }
      : { kind: "baseline" };
  }
  if (baseline.id === run.id) return { kind: "baseline" };
  if (run.fingerprint === baseline.fingerprint)
    return { kind: "identical", baselineId: baseline.id };
  if (run.doubleCounts > 0)
    return { kind: "quirk", baselineId: baseline.id, extra: run.doubleCounts };
  return { kind: "differs", baselineId: baseline.id };
}

/** Worker counts the original layout accepts, up to `max` (2 is impossible: see getTaskRanks). */
export function sweepSizes(max: number): number[] {
  return [1, ...Array.from({ length: Math.max(0, max - 2) }, (_, i) => i + 3)];
}
