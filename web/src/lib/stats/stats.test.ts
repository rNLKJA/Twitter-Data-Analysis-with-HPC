import { describe, expect, it } from "vitest";

import { createRng } from "../synth/prng";
import { bootstrapInterval, percentileInterval } from "./bootstrap";
import { mean, median, quantile } from "./descriptive";
import { formatInterval } from "./interval";
import { normalQuantile, zFor } from "./normal";
import { comparePaired, mcnemarExact } from "./paired";
import { wilson } from "./proportion";

/*
 * Reference values come from scripts/stats_reference.py (numpy 2.3, scipy
 * 1.16, statsmodels 0.14) and were cross-checked in R 4 (quantile type 7,
 * prop.test(correct = FALSE), binom.test, lm(y ~ 0 + x)).
 */

const X = [3.1, 0.4, 2.2, 9.7, 5.5, 1.0, 4.8];

describe("descriptive", () => {
  it("matches numpy / R type-7 quantiles", () => {
    expect(quantile(X, 0.025)).toBeCloseTo(0.49000000000000005, 12);
    expect(quantile(X, 0.1)).toBeCloseTo(0.76, 12);
    expect(quantile(X, 0.5)).toBe(3.1);
    expect(quantile(X, 0.9)).toBeCloseTo(7.1800000000000015, 12);
    expect(quantile(X, 0.975)).toBeCloseTo(9.069999999999999, 12);
    expect(quantile(X, 0)).toBe(0.4);
    expect(quantile(X, 1)).toBe(9.7);
  });

  it("handles medians of even length and empty input", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBeNaN();
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBeNaN();
  });

  it("does not reorder its input", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe("normal quantile", () => {
  it("matches scipy.stats.norm.ppf", () => {
    const ref: Array<[number, number]> = [
      [0.001, -3.090232306167813],
      [0.025, -1.9599639845400545],
      [0.9, 1.2815515655446004],
      [0.975, 1.959963984540054],
      [0.995, 2.5758293035489004],
    ];
    for (const [p, z] of ref) expect(normalQuantile(p)).toBeCloseTo(z, 8);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 12);
    expect(zFor(0.95)).toBeCloseTo(1.959963984540054, 8);
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(normalQuantile(1.5)).toBeNaN();
  });
});

describe("Wilson interval", () => {
  it("matches statsmodels' wilson and R's prop.test(correct = FALSE)", () => {
    const ref: Array<[number, number, number, number]> = [
      [0, 10, 0.0, 0.27753279986288926],
      [14, 14, 0.7846891972623641, 1],
      [7, 12, 0.31951131254954973, 0.8067396863412435],
      [1, 24, 0.007393456165505796, 0.20241806478655947],
      [20, 24, 0.6414692935030094, 0.9332132367136706],
    ];
    for (const [k, n, lo, hi] of ref) {
      const w = wilson(k, n);
      expect(w.estimate).toBeCloseTo(k / n, 12);
      expect(w.lo).toBeCloseTo(lo, 8);
      expect(w.hi).toBeCloseTo(hi, 8);
    }
  });

  it("rejects impossible counts", () => {
    expect(wilson(1, 0).lo).toBeNaN();
    expect(wilson(5, 4).hi).toBeNaN();
  });
});

describe("McNemar exact test", () => {
  it("matches scipy.stats.binomtest on the discordant pairs", () => {
    expect(mcnemarExact(5, 1)).toBeCloseTo(0.21875, 12);
    expect(mcnemarExact(0, 6)).toBeCloseTo(0.03125, 12);
    expect(mcnemarExact(2, 9)).toBeCloseTo(0.0654296875, 12);
    expect(mcnemarExact(1, 106) / 1.3312027775604574e-30).toBeCloseTo(1, 8);
    expect(mcnemarExact(0, 0)).toBe(1);
    expect(mcnemarExact(3, 3)).toBe(1);
  });

  it("summarises a paired comparison with a seeded bootstrap interval", () => {
    const a = [true, true, true, true, true, false, true, true, false, true];
    const b = [true, false, false, true, false, false, true, false, false, true];
    const c = comparePaired(a, b, { resamples: 2000, seed: 7 });
    expect(c).toMatchObject({ n: 10, onlyA: 4, onlyB: 0, bothPass: 4, bothFail: 2 });
    expect(c.difference.estimate).toBeCloseTo(0.4, 12);
    expect(c.p).toBeCloseTo(0.125, 12);
    expect(c.difference.lo).toBeGreaterThan(0);
    expect(c.difference.hi).toBeLessThanOrEqual(0.8);
    // Same seed, same interval.
    expect(comparePaired(a, b, { resamples: 2000, seed: 7 }).difference).toEqual(c.difference);
    expect(() => comparePaired([true], [])).toThrow(RangeError);
  });
});

describe("percentile bootstrap", () => {
  it("uses the same mulberry32 stream as the reference script", () => {
    const rng = createRng(2023);
    const first = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next()];
    expect(first).toEqual([
      0.346355166984722, 0.5043564201332629, 0.8568998796399683, 0.8930063100997359,
      0.6905035339295864,
    ]);
  });

  it("reproduces the reference median interval draw for draw", () => {
    const i = bootstrapInterval(X, median, { resamples: 2000, seed: 90024 });
    expect(i).toEqual({ estimate: 3.1, lo: 1.0, hi: 5.5, level: 0.95 });
  });

  it("keeps unbounded replicates visible", () => {
    expect(percentileInterval([1, 2, 3, Infinity, Infinity], 0.5)).toEqual([2, Infinity]);
    expect(percentileInterval([NaN, NaN], 0.95)).toEqual([NaN, NaN]);
  });

  it("formats an interval", () => {
    expect(
      formatInterval({ estimate: 0.032, lo: 0.021, hi: 0.04, level: 0.95 }, (v) => v.toFixed(3)),
    ).toBe("0.032 (95% CI 0.021 to 0.040)");
  });
});
