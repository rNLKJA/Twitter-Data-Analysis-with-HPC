/**
 * Coverage simulation for the benchmark's intervals: how often does each
 * "95%" interval actually contain the true value, at the round counts the
 * lab offers? Wall times are simulated from Amdahl's law with multiplicative
 * lognormal noise,
 *
 *   T(n) = t1 · (f + (1 − f)/n) · exp(σ·Z),   Z ~ N(0, 1) independent per run,
 *
 * so the true median of T(n) is t1·(f + (1 − f)/n), the true speedup is
 * Amdahl's 1 / (f + (1 − f)/n), and the true serial fraction is f. Each
 * simulated benchmark goes through summariseBenchmark exactly as a real one
 * does. Seeded, so the figures in DR-004 can be reproduced:
 *
 *     pnpm coverage-sim
 */
import { amdahlSpeedup, amdahlTime } from "../amdahl";
import { bootstrapInterval } from "../stats/bootstrap";
import { median } from "../stats/descriptive";
import { createRng, type Rng } from "../synth/prng";
import { summariseBenchmark, type BenchmarkSample } from "./benchmark";

export interface CoverageOptions {
  /** Timed rounds per simulated benchmark. */
  repeats: number;
  /** Simulated benchmarks. */
  sims: number;
  sizes: readonly number[];
  /** True serial fraction. */
  f: number;
  /** Log-scale standard deviation of the run-to-run noise. */
  sigma: number;
  t1Ms?: number;
  seed?: number;
  /** Bootstrap resamples per benchmark (the lab uses 2,000). */
  resamples?: number;
  /** Allow round counts below MIN_INTERVAL_ROUNDS (to show why they are not offered). */
  allowFewRounds?: boolean;
}

export interface CoverageResult {
  repeats: number;
  sims: number;
  sizes: number[];
  /** Share of benchmarks whose interval contained the truth, per worker count. */
  median: Record<number, number>;
  speedup: Record<number, number>;
  serialFraction: number;
  /** Mean exact coverage claimed by the order-statistic median interval. */
  claimedMedianCoverage: number;
}

/** Standard normal draw (Box–Muller) from the seeded generator. */
function normal(rng: Rng): number {
  const u = 1 - rng.next();
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function simulateCoverage(opts: CoverageOptions): CoverageResult {
  const { repeats, sims, f, sigma, t1Ms = 1000, seed = 4_2023, resamples = 2000 } = opts;
  const sizes = [...new Set(opts.sizes)].sort((a, b) => a - b);
  const rng = createRng(seed);
  const hits = {
    median: new Map(sizes.map((n) => [n, 0])),
    speedup: new Map(sizes.map((n) => [n, 0])),
    f: 0,
  };
  let claimed = 0;
  let claimedCount = 0;
  const inside = (lo: number, hi: number, v: number) => lo <= v + 1e-12 && v - 1e-12 <= hi;

  for (let s = 0; s < sims; s++) {
    const samples: BenchmarkSample[] = [];
    let runId = 0;
    for (let round = 0; round < repeats; round++) {
      for (const n of sizes) {
        const wallMs = amdahlTime(t1Ms, f, n) * Math.exp(sigma * normal(rng));
        samples.push({ round, size: n, wallMs, scanMs: wallMs, runId: ++runId });
      }
    }
    const summary = summariseBenchmark(samples, sizes, {
      resamples,
      seed: 90024 + s,
      ...(opts.allowFewRounds ? { minRounds: 2 } : {}),
    });
    if (!summary) throw new RangeError(`too few rounds (${repeats}) for an interval`);
    for (const c of summary.configs) {
      if (inside(c.wallMs.lo, c.wallMs.hi, amdahlTime(t1Ms, f, c.n)))
        hits.median.set(c.n, hits.median.get(c.n)! + 1);
      claimed += c.wallMs.coverage;
      claimedCount++;
      if (c.n > 1 && inside(c.speedup.lo, c.speedup.hi, amdahlSpeedup(f, c.n)))
        hits.speedup.set(c.n, hits.speedup.get(c.n)! + 1);
    }
    if (summary.serialFraction && inside(summary.serialFraction.lo, summary.serialFraction.hi, f))
      hits.f++;
  }

  const rate = (m: Map<number, number>) =>
    Object.fromEntries([...m.entries()].map(([n, k]) => [n, k / sims]));
  return {
    repeats,
    sims,
    sizes,
    median: rate(hits.median),
    speedup: rate(new Map([...hits.speedup.entries()].filter(([n]) => n > 1))),
    serialFraction: hits.f / sims,
    claimedMedianCoverage: claimed / claimedCount,
  };
}

/**
 * Coverage of the first version's interval for a median wall time (a
 * percentile bootstrap of the median), for comparison: with few runs it can
 * only land on a handful of order statistics.
 */
export function simulateBootstrapMedianCoverage({
  repeats,
  sims,
  sigma,
  seed = 4_2023,
  resamples = 2000,
}: {
  repeats: number;
  sims: number;
  sigma: number;
  seed?: number;
  resamples?: number;
}): number {
  const rng = createRng(seed);
  let hits = 0;
  for (let s = 0; s < sims; s++) {
    const xs = Array.from({ length: repeats }, () => 1000 * Math.exp(sigma * normal(rng)));
    const i = bootstrapInterval(xs, median, { resamples, seed: 90024 + s });
    if (i.lo <= 1000 && 1000 <= i.hi) hits++;
  }
  return hits / sims;
}
