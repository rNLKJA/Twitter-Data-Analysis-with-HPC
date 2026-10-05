import { describe, expect, it } from "vitest";

import gazetteer from "../../../public/data/gazetteer.json";
import { runPipeline } from "../cruncher/pipeline";
import { generateSyntheticFile } from "../synth/generator";
import {
  bestTimes,
  resultsFingerprint,
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
  const rec = (id: number, size: number, wallMs: number, fileId = "a"): RunRecord => ({
    id,
    fileId,
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

describe("sweepSizes", () => {
  it("skips the impossible 2-rank layout", () => {
    expect(sweepSizes(8)).toEqual([1, 3, 4, 5, 6, 7, 8]);
    expect(sweepSizes(3)).toEqual([1, 3]);
    expect(sweepSizes(1)).toEqual([1]);
  });
});
