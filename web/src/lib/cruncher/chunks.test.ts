import { describe, expect, it } from "vitest";

import { gatherOrder, getTaskRanks, isSupportedRankCount, splitFileIntoChunks } from "./chunks";

describe("splitFileIntoChunks (port of utils.split_file_into_chunks)", () => {
  it("reproduces the byte ranges the original computed for tinyTwitter.json (1,471,015 bytes)", () => {
    expect(splitFileIntoChunks(1_471_015, 4)).toEqual({
      start: [0, 367_754, 735_508, 1_103_262],
      end: [367_754, 735_508, 1_103_262, 1_471_015],
    });
    expect(splitFileIntoChunks(1_471_015, 3).start).toEqual([0, 490_339, 980_678]);
  });

  it("splits bigTwitter.json (18,735,307,060 bytes) into 8 equal ranges", () => {
    const { start, end } = splitFileIntoChunks(18_735_307_060, 8);
    expect(start).toHaveLength(8);
    expect(end[7]).toBe(18_735_307_060);
    expect(start[1]).toBe(Math.ceil(18_735_307_060 / 8));
  });

  it("can yield fewer chunks than ranks for tiny files, like the original", () => {
    expect(splitFileIntoChunks(9, 4).start).toEqual([0, 3, 6]);
  });
});

describe("task ranks (port of mpi.get_task_ranks / gather_task_tdf)", () => {
  it("puts every task on rank 0 for a single process", () => {
    expect(getTaskRanks(1)).toEqual([0, 0, 0]);
  });

  it("spreads the tasks over ranks 0, 1, 2 otherwise", () => {
    expect(getTaskRanks(8)).toEqual([0, 1, 2]);
  });

  it("rejects two ranks, where Task 3 would target a missing rank 2", () => {
    expect(isSupportedRankCount(2)).toBe(false);
    expect(isSupportedRankCount(3)).toBe(true);
  });

  it("gathers the task rank's own frame first, then the others in order", () => {
    expect(gatherOrder(1, 4)).toEqual([1, 0, 2, 3]);
  });
});
