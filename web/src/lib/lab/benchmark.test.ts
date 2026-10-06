import { describe, expect, it } from "vitest";

import {
  BENCHMARK_DEFAULTS,
  completeRounds,
  MIN_INTERVAL_ROUNDS,
  planBenchmark,
  REPEAT_OPTIONS,
  roughSummary,
  samplesCsv,
  spacedSizes,
  summariseBenchmark,
  type BenchmarkSample,
} from "./benchmark";
import { simulateCoverage } from "./coverage";

// The same table as scripts/stats_reference.py: 5 rounds × {1, 3, 4, 8} workers (ms).
const TABLE: Array<Record<number, number>> = [
  { 1: 1000, 3: 380, 4: 300, 8: 190 },
  { 1: 1040, 3: 395, 4: 310, 8: 205 },
  { 1: 985, 3: 370, 4: 296, 8: 182 },
  { 1: 1120, 3: 410, 4: 330, 8: 220 },
  { 1: 1010, 3: 377, 4: 305, 8: 188 },
];
const SIZES = [1, 3, 4, 8];

function samples(): BenchmarkSample[] {
  let runId = 0;
  return TABLE.flatMap((row, round) =>
    SIZES.map((size) => ({
      round,
      size,
      wallMs: row[size],
      scanMs: row[size] * 0.9,
      runId: ++runId,
    })),
  );
}

describe("planBenchmark", () => {
  it("runs warm-up rounds first, then every count once per round in a seeded order", () => {
    const plan = { sizes: [8, 1, 3, 4], repeats: 3, warmupRounds: 1, orderSeed: 2023 };
    const runs = planBenchmark(plan);
    expect(runs).toHaveLength(16);
    expect(runs.slice(0, 4).every((r) => r.warmup && r.round === -1)).toBe(true);
    for (let r = 0; r < 3; r++) {
      const round = runs.filter((x) => x.round === r).map((x) => x.size);
      expect([...round].sort((a, b) => a - b)).toEqual([1, 3, 4, 8]);
    }
    expect(runs.map((r) => r.index)).toEqual([...Array(16).keys()]);
    // Seeded: same plan, same order; the order is not simply ascending every round.
    expect(planBenchmark(plan)).toEqual(runs);
    const orders = new Set(
      [0, 1, 2].map((r) =>
        runs
          .filter((x) => x.round === r)
          .map((x) => x.size)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("needs a 1-worker baseline", () => {
    expect(() =>
      planBenchmark({ sizes: [3, 4], repeats: 2, warmupRounds: 0, orderSeed: 1 }),
    ).toThrow(RangeError);
  });
});

describe("summariseBenchmark", () => {
  it("matches the numpy and R references (order-statistic medians, round bootstrap, seed 90024)", () => {
    const s = summariseBenchmark(samples(), SIZES, { resamples: 2000, seed: 90024 })!;
    expect(s.rounds).toBe(5);
    const by = (n: number) => s.configs.find((c) => c.n === n)!;

    // Five rounds: the order-statistic interval is [min, max], exact coverage 93.75%.
    expect(by(1).wallMs).toMatchObject({ estimate: 1010, lo: 985, hi: 1120, coverage: 0.9375 });
    expect(by(8).wallMs).toMatchObject({ estimate: 190, lo: 182, hi: 220, coverage: 0.9375 });
    expect(by(3).speedup.estimate).toBeCloseTo(2.6578947368421053, 12);
    expect(by(3).speedup.lo).toBeCloseTo(2.6315789473684212, 12);
    expect(by(3).speedup.hi).toBeCloseTo(2.731707317073171, 12);
    expect(by(8).speedup.estimate).toBeCloseTo(5.315789473684211, 12);
    expect(by(8).speedup.lo).toBeCloseTo(5.073170731707317, 12);
    expect(by(8).speedup.hi).toBeCloseTo(5.412087912087912, 12);
    expect(by(8).efficiency.estimate).toBeCloseTo(5.315789473684211 / 8, 12);
    expect(by(8).karpFlatt!.estimate).toBeCloseTo(0.07213578500707214, 12);
    expect(by(1).karpFlatt).toBeNull();

    expect(s.serialFraction!.estimate).toBeCloseTo(0.06928753600139642, 12);
    expect(s.serialFraction!.lo).toBeCloseTo(0.06646145235763257, 12);
    expect(s.serialFraction!.hi).toBeCloseTo(0.0734197242522414, 12);
    expect(s.ceiling!.estimate).toBeCloseTo(1 / 0.06928753600139642, 9);
    expect(s.ceiling!.lo).toBeCloseTo(1 / 0.0734197242522414, 9);
    expect(by(4)).toMatchObject({ runs: 5, minMs: 296, maxMs: 330 });
  });

  it("only uses complete timed rounds, and needs MIN_INTERVAL_ROUNDS of them", () => {
    const all = samples();
    const partial = [
      ...all,
      { round: 5, size: 1, wallMs: 5000, scanMs: 1, runId: 99 },
      { round: -1, size: 8, wallMs: 9999, scanMs: 1, runId: 100 },
    ];
    expect(completeRounds(partial, SIZES)).toEqual([0, 1, 2, 3, 4]);
    const s = summariseBenchmark(partial, SIZES, { resamples: 2000, seed: 90024 })!;
    expect(s.configs.find((c) => c.n === 1)!.wallMs.estimate).toBe(1010);
    expect(MIN_INTERVAL_ROUNDS).toBe(5);
    expect(
      summariseBenchmark(
        all.filter((x) => x.round < 4),
        SIZES,
      ),
    ).toBeNull();
    expect(summariseBenchmark(all, [3, 4])).toBeNull();
  });

  it("summarises fewer rounds as medians and ranges only", () => {
    const two = samples().filter((x) => x.round < 2);
    const r = roughSummary(two, SIZES)!;
    expect(r.rounds).toBe(2);
    expect(r.configs.find((c) => c.n === 1)).toEqual({
      n: 1,
      runs: 2,
      medianMs: 1020,
      minMs: 1000,
      maxMs: 1040,
    });
    expect(roughSummary([], SIZES)).toBeNull();
  });

  it("defaults to enough rounds for intervals that hold their coverage", () => {
    expect(BENCHMARK_DEFAULTS.repeats).toBe(10);
    expect(Math.min(...REPEAT_OPTIONS)).toBeGreaterThanOrEqual(MIN_INTERVAL_ROUNDS);
  });

  it("has no serial fraction with a single worker count", () => {
    const s = summariseBenchmark(
      samples().filter((x) => x.size === 1),
      [1],
      { resamples: 200, seed: 1 },
    )!;
    expect(s.serialFraction).toBeNull();
    expect(s.ceiling).toBeNull();
  });
});

describe("coverage simulation", () => {
  it("is seeded, and the order-statistic median interval holds its coverage", () => {
    const opts = { repeats: 10, sims: 60, sizes: [1, 4], f: 0.2, sigma: 0.1, resamples: 300 };
    const a = simulateCoverage(opts);
    expect(simulateCoverage(opts)).toEqual(a);
    expect(a.claimedMedianCoverage).toBeCloseTo(0.978515625, 12);
    // 60 benchmarks: allow for simulation noise around the exact 97.9%.
    expect(a.median[1]).toBeGreaterThanOrEqual(0.9);
    expect(a.median[4]).toBeGreaterThanOrEqual(0.9);
    expect(Object.keys(a.speedup)).toEqual(["4"]);
    expect(() => simulateCoverage({ ...opts, repeats: 3 })).toThrow(RangeError);
  });
});

describe("helpers", () => {
  it("spaces worker counts for a quick benchmark", () => {
    expect(spacedSizes(16)).toEqual([1, 3, 4, 6, 8, 12, 16]);
    expect(spacedSizes(10)).toEqual([1, 3, 4, 6, 8, 10]);
    expect(spacedSizes(4)).toEqual([1, 3, 4]);
  });

  it("writes timed samples as CSV", () => {
    const csv = samplesCsv([
      { round: -1, size: 1, wallMs: 1, scanMs: 1, runId: 1 },
      { round: 0, size: 4, wallMs: 250.5, scanMs: 200.25, runId: 2 },
    ]);
    expect(csv).toBe("round,workers,wall_ms,scan_ms,run_id\n0,4,250.500,200.250,2\n");
  });
});
