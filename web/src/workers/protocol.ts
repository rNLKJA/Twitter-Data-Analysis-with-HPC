import type { ProcessorStats } from "@/lib/cruncher/processor";
import type { RankPartials, Task1Row, Task2Row, Task3Result } from "@/lib/cruncher/tasks";

/** Wall-clock timestamps comparable across the page and its workers (ms since epoch). */
export function now(): number {
  return performance.timeOrigin + performance.now();
}

// ───────────────────────── synthetic file generator ─────────────────────────

export type SynthRequest = { type: "generate"; seed: number; tweets: number };

export type SynthResponse =
  | { type: "progress"; tweets: number; total: number; bytes: number }
  | { type: "done"; blob: Blob; tweets: number; bytes: number; ms: number; head: string }
  | { type: "error"; message: string };

// ───────────────────────────────── MPI rank ─────────────────────────────────

export type RankRequest =
  | {
      type: "scan";
      runId: number;
      rank: number;
      size: number;
      blob: Blob;
      start: number;
      end: number;
      /** sal_dict entries (location → gcc) */
      dict: ReadonlyArray<readonly [string, string]>;
    }
  | {
      type: "reduce";
      runId: number;
      task: 1 | 2 | 3;
      /** Partial tables in gather_task_tdf order (own first, then the other ranks). */
      partials: unknown[];
    };

export type RankResponse =
  | { type: "ready" }
  | { type: "progress"; runId: number; rank: number; bytesRead: number; tweets: number }
  | {
      type: "scanned";
      runId: number;
      rank: number;
      partials: RankPartials;
      tweets: number;
      matched: number;
      stats: ProcessorStats;
      bytesFetched: number;
      scanStart: number;
      scanEnd: number;
    }
  | {
      type: "reduced";
      runId: number;
      task: 1 | 2 | 3;
      result: Task1Row[] | Task2Row[] | Task3Result;
      reduceStart: number;
      reduceEnd: number;
    }
  | { type: "error"; runId: number; rank?: number; message: string };
