import { describe, expect, it } from "vitest";

import {
  amdahlSpeedup,
  fitSerialFraction,
  gustafsonSpeedup,
  karpFlatt,
  serialFractionRoundingRange,
} from "./amdahl";
import { BENCHMARKS } from "./data/original";

describe("Amdahl fit", () => {
  it("matches R's lm(y ~ 0 + x) on the linearised law", () => {
    // n <- c(3, 4, 6, 8); S <- c(2.7, 3.4, 4.6, 5.6)
    // coef(lm(1/S - 1/n ~ 0 + I(1 - 1/n))) = 0.059555856325538732
    const f = fitSerialFraction([
      { n: 3, s: 2.7 },
      { n: 4, s: 3.4 },
      { n: 6, s: 4.6 },
      { n: 8, s: 5.6 },
    ]);
    expect(f).toBeCloseTo(0.059555856325538732, 12);
  });

  it("reduces to Karp–Flatt on Spartan's runs, which have one distinct n > 1", () => {
    const t1 = BENCHMARKS.find((b) => b.cores === 1)!.seconds;
    const pts = BENCHMARKS.filter((b) => b.cores > 1).map((b) => ({
      n: b.cores,
      s: t1 / b.seconds,
    }));
    expect(new Set(pts.map((p) => p.n)).size).toBe(1);
    expect(fitSerialFraction(pts)).toBeCloseTo(karpFlatt(661 / 101, 8), 12);
    expect(fitSerialFraction(pts)).toBeCloseTo(0.03177, 5);
  });
});

describe("Gustafson's law", () => {
  it("is linear in n with slope 1 - s", () => {
    expect(gustafsonSpeedup(0.05, 1)).toBe(1);
    expect(gustafsonSpeedup(0.05, 8)).toBeCloseTo(7.65, 12);
    expect(gustafsonSpeedup(0, 16)).toBe(16);
    // Always at least Amdahl's speedup for the same fraction.
    for (const n of [2, 8, 32])
      expect(gustafsonSpeedup(0.1, n)).toBeGreaterThan(amdahlSpeedup(0.1, n));
  });
});

describe("rounding range", () => {
  it("brackets Spartan's fit using whole-second clock resolution", () => {
    const [lo, hi] = serialFractionRoundingRange(661, 101, 8);
    // Fastest plausible: 661.5 s / 100.5 s; slowest: 660.5 s / 101.5 s.
    expect(lo).toBeCloseTo(karpFlatt(661.5 / 100.5, 8), 12);
    expect(hi).toBeCloseTo(karpFlatt(660.5 / 101.5, 8), 12);
    expect(lo).toBeLessThan(karpFlatt(661 / 101, 8));
    expect(hi).toBeGreaterThan(karpFlatt(661 / 101, 8));
    expect(lo).toBeCloseTo(0.03077, 4);
    expect(hi).toBeCloseTo(0.03277, 4);
  });
});
