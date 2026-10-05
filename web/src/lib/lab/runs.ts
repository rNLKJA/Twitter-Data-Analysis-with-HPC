import { fitSerialFraction, type ScalingPoint } from "../amdahl";
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
 * Book-keeping for the browser MPI lab: comparing task outputs between runs,
 * and turning a run history into speedup points for the Amdahl fit.
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

export interface RunRecord {
  id: number;
  fileId: string;
  size: number;
  wallMs: number;
  /** Slowest rank's scan time: the parallel part. */
  scanMs: number;
  fingerprint: string;
  /** Chunk boundaries that made two ranks count the same tweet (see cruncher/boundary.ts). */
  doubleCounts: number;
}

/** Best (minimum) wall-clock per worker count for one file. */
export function bestTimes(history: readonly RunRecord[], fileId: string): Map<number, number> {
  const best = new Map<number, number>();
  for (const r of history) {
    if (r.fileId !== fileId) continue;
    const prev = best.get(r.size);
    if (prev === undefined || r.wallMs < prev) best.set(r.size, r.wallMs);
  }
  return best;
}

export interface SpeedupSummary {
  /** Best 1-worker time, if measured. */
  t1Ms: number | null;
  points: Array<{ n: number; wallMs: number; speedup: number | null }>;
  /** Least-squares serial fraction (needs t1 and at least one n > 1). */
  serialFraction: number | null;
}

export function summariseSpeedup(history: readonly RunRecord[], fileId: string): SpeedupSummary {
  const best = bestTimes(history, fileId);
  const t1Ms = best.get(1) ?? null;
  const points = [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, wallMs]) => ({ n, wallMs, speedup: t1Ms === null ? null : t1Ms / wallMs }));
  const fitPoints: ScalingPoint[] = points
    .filter((p) => p.n > 1 && p.speedup !== null)
    .map((p) => ({ n: p.n, s: p.speedup! }));
  return {
    t1Ms,
    points,
    serialFraction: t1Ms !== null && fitPoints.length > 0 ? fitSerialFraction(fitPoints) : null,
  };
}

/** Worker counts the original layout accepts, up to `max` (2 is impossible: see getTaskRanks). */
export function sweepSizes(max: number): number[] {
  return [1, ...Array.from({ length: Math.max(0, max - 2) }, (_, i) => i + 3)];
}
