import { describe, expect, it } from "vitest";

import gazetteer from "../../../public/data/gazetteer.json";
import { idIndentBoundaryRanks } from "../cruncher/boundary";
import { splitFileIntoChunks } from "../cruncher/chunks";
import { runPipeline } from "../cruncher/pipeline";
import { generateSyntheticFile } from "../synth/generator";
import {
  bestTimes,
  checkOutput,
  cleanBaseline,
  dictHash,
  resultsFingerprint,
  runKey,
  summariseSpeedup,
  sweepSizes,
  type RunRecord,
} from "./runs";

const dict = new Map(Object.entries(gazetteer.dict as Record<string, string>));

describe("resultsFingerprint", () => {
  const bytes = generateSyntheticFile({ seed: 7, tweets: 600 });

  it("is identical for every supported rank count (chunk boundaries never change the answer)", () => {
    const prints = [1, 3, 4, 5, 8, 11].map((n) => resultsFingerprint(runPipeline(bytes, dict, n)));
    expect(new Set(prints).size).toBe(1);
  });

  it("differs for a different file", () => {
    const other = generateSyntheticFile({ seed: 8, tweets: 600 });
    expect(resultsFingerprint(runPipeline(other, dict, 1))).not.toBe(
      resultsFingerprint(runPipeline(bytes, dict, 1)),
    );
  });
});

describe("run history", () => {
  const rec = (id: number, size: number, wallMs: number, key = "a"): RunRecord => ({
    id,
    key,
    size,
    wallMs,
    scanMs: wallMs * 0.9,
    fingerprint: "x",
    doubleCounts: 0,
  });
  const history = [
    rec(1, 1, 800),
    rec(2, 1, 760),
    rec(3, 4, 240),
    rec(4, 8, 150),
    rec(5, 8, 170),
    rec(6, 1, 10, "b"),
  ];

  it("keeps the best time per size for one file", () => {
    expect([...bestTimes(history, "a").entries()]).toEqual([
      [1, 760],
      [4, 240],
      [8, 150],
    ]);
  });

  it("derives speedups and a serial fraction", () => {
    const s = summariseSpeedup(history, "a");
    expect(s.t1Ms).toBe(760);
    expect(s.points.map((p) => p.n)).toEqual([1, 4, 8]);
    expect(s.points[2].speedup).toBeCloseTo(760 / 150);
    expect(s.serialFraction).toBeGreaterThan(0);
    expect(s.serialFraction).toBeLessThan(0.2);
  });

  it("needs a 1-worker baseline before fitting", () => {
    const s = summariseSpeedup([rec(1, 4, 100)], "a");
    expect(s.t1Ms).toBeNull();
    expect(s.serialFraction).toBeNull();
    expect(s.points[0].speedup).toBeNull();
  });
});

describe("checkOutput: the baseline is the first clean run", () => {
  const rec = (
    id: number,
    size: number,
    fingerprint: string,
    doubleCounts = 0,
    key = "f|d",
  ): RunRecord => ({
    id,
    key,
    size,
    wallMs: 100,
    scanMs: 90,
    fingerprint,
    doubleCounts,
  });

  it("6 ranks (double count) → 8 → 1: the 6-rank run is the odd one out, not the correct ones", () => {
    const history = [rec(1, 6, "plus-one", 1), rec(2, 8, "clean"), rec(3, 1, "clean")];
    expect(cleanBaseline(history, "f|d")?.id).toBe(2);
    expect(checkOutput(history[0], history)).toEqual({ kind: "quirk", baselineId: 2, extra: 1 });
    expect(checkOutput(history[1], history)).toEqual({ kind: "baseline" });
    expect(checkOutput(history[2], history)).toEqual({ kind: "identical", baselineId: 2 });
  });

  it("6 → 9 ranks, each double-counting a different tweet: both explained, no false alarm", () => {
    const history = [rec(1, 6, "plus-tweet-a", 1), rec(2, 9, "plus-tweet-b", 1)];
    expect(cleanBaseline(history, "f|d")).toBeUndefined();
    expect(checkOutput(history[0], history)).toEqual({ kind: "quirk", baselineId: null, extra: 1 });
    expect(checkOutput(history[1], history)).toEqual({ kind: "quirk", baselineId: null, extra: 1 });
    // a later 1-rank run becomes the baseline and both earlier runs are re-labelled against it
    const later = [...history, rec(3, 1, "clean")];
    expect(checkOutput(later[0], later)).toEqual({ kind: "quirk", baselineId: 3, extra: 1 });
    expect(checkOutput(later[1], later)).toEqual({ kind: "quirk", baselineId: 3, extra: 1 });
    expect(checkOutput(later[2], later)).toEqual({ kind: "baseline" });
  });

  it("6 → 1: the 1-rank run is the baseline, never '-1 tweet'", () => {
    const history = [rec(1, 6, "plus-one", 1), rec(2, 1, "clean")];
    expect(checkOutput(history[1], history)).toEqual({ kind: "baseline" });
    expect(checkOutput(history[0], history)).toEqual({ kind: "quirk", baselineId: 2, extra: 1 });
  });

  it("flags a clean run that differs from the clean baseline", () => {
    const history = [rec(1, 1, "clean"), rec(2, 4, "something-else")];
    expect(checkOutput(history[1], history)).toEqual({ kind: "differs", baselineId: 1 });
  });

  it("only compares runs with the same file and dictionary", () => {
    const history = [
      rec(1, 1, "gazetteer-answer", 0, "f|gaz"),
      rec(2, 1, "sal-answer", 0, "f|sal"),
    ];
    expect(checkOutput(history[1], history)).toEqual({ kind: "baseline" });
    expect(bestTimes(history, "f|sal").size).toBe(1);
  });

  it("on the real port: 27 and 39 ranks double-count, 1 and 4 ranks match", () => {
    const bytes = generateSyntheticFile({ seed: 2023, tweets: 400 });
    const history: RunRecord[] = [];
    for (const [id, size] of [27, 39, 1, 4].entries()) {
      const r = runPipeline(bytes, dict, size);
      const doubleCounts = idIndentBoundaryRanks(
        bytes,
        splitFileIntoChunks(bytes.length, size).start,
      ).length;
      history.push({
        id: id + 1,
        key: "synthetic",
        size,
        wallMs: 1,
        scanMs: 1,
        fingerprint: resultsFingerprint(r),
        doubleCounts,
      });
    }
    expect(history.map((h) => h.doubleCounts)).toEqual([1, 1, 0, 0]);
    expect(checkOutput(history[2], history)).toEqual({ kind: "baseline" });
    expect(checkOutput(history[3], history)).toEqual({ kind: "identical", baselineId: 3 });
    for (const h of history.slice(0, 2)) {
      expect(checkOutput(h, history).kind).not.toBe("differs");
    }
  });
});

describe("runKey", () => {
  it("separates dictionaries with the same name but different entries", () => {
    const a = dictHash([["melbourne", "2gmel"]]);
    const b = dictHash([["melbourne", "1gsyd"]]);
    expect(a).not.toBe(b);
    expect(runKey("file", { source: "sal", name: "sal.json", hash: a })).not.toBe(
      runKey("file", { source: "sal", name: "sal.json", hash: b }),
    );
    expect(dictHash([["melbourne", "2gmel"]])).toBe(a);
  });
});

describe("sweepSizes", () => {
  it("skips the impossible 2-rank layout", () => {
    expect(sweepSizes(8)).toEqual([1, 3, 4, 5, 6, 7, 8]);
    expect(sweepSizes(3)).toEqual([1, 3]);
    expect(sweepSizes(1)).toEqual([1]);
  });
});
