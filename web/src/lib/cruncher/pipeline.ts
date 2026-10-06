import { MemoryByteFile, type ByteFile } from "./byte-file";
import { gatherOrder, getTaskRanks, isSupportedRankCount, splitFileIntoChunks } from "./chunks";
import type { SalDict } from "./normalise";
import { twitterProcessorV1, type TweetFrame } from "./processor";
import {
  rankPartials,
  reduceTask1,
  reduceTask2,
  reduceTask3,
  type RankPartials,
  type Task1Row,
  type Task2Row,
  type Task3Result,
} from "./tasks";

export interface RankSummary {
  rank: number;
  start: number;
  end: number;
  tweets: number;
  matched: number;
}

export interface PipelineResult {
  ranks: RankSummary[];
  task1: Task1Row[];
  task2: Task2Row[];
  task3: Task3Result;
  /** Only populated for single-rank runs when `keepFrame` is set. */
  frame?: TweetFrame;
}

/**
 * Sequential re-enactment of main.py for `size` ranks: every rank scans its
 * byte range, computes its three partial tables, and the task ranks reduce
 * the gathered partials in `gather_task_tdf` order. The browser runs the same
 * steps on real Web Workers; this version backs the tests and CLI.
 */
export function runPipeline(
  input: Uint8Array | ByteFile,
  salDict: SalDict,
  size: number,
  { keepFrame = false }: { keepFrame?: boolean } = {},
): PipelineResult {
  if (!isSupportedRankCount(size)) {
    throw new RangeError(`The original task layout cannot run on ${size} ranks (needs 1 or >= 3).`);
  }
  const file = input instanceof Uint8Array ? new MemoryByteFile(input) : input;
  const { start, end } = splitFileIntoChunks(file.size, size);
  if (start.length !== size) {
    throw new RangeError(`File too small to split into ${size} chunks (got ${start.length}).`);
  }

  const partials: RankPartials[] = [];
  const ranks: RankSummary[] = [];
  let frame: TweetFrame | undefined;
  for (let rank = 0; rank < size; rank++) {
    const { frame: f } = twitterProcessorV1(file, start[rank], end[rank], salDict);
    partials.push(rankPartials(f));
    ranks.push({
      rank,
      start: start[rank],
      end: end[rank],
      tweets: f.tweetId.length,
      matched: f.gcc.filter((g) => g !== null).length,
    });
    if (keepFrame && size === 1) frame = f;
  }

  const [t1Rank, t2Rank, t3Rank] = getTaskRanks(size);
  const task1 = reduceTask1(gatherOrder(t1Rank, size).map((r) => partials[r].t1));
  const task2 = reduceTask2(gatherOrder(t2Rank, size).map((r) => partials[r].t2));
  const task3 = reduceTask3(gatherOrder(t3Rank, size).map((r) => partials[r].t3));

  return { ranks, task1, task2, task3, frame };
}
