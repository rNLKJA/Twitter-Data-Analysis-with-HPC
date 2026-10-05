import { createRng, type Rng } from "../synth/prng";
import { quantileSorted } from "./descriptive";
import type { Interval } from "./interval";

/**
 * Seeded percentile bootstrap. The generator is the same mulberry32 stream
 * the synthetic data uses, so a given seed always gives the same interval in
 * every browser and in the tests.
 */

export interface BootstrapOptions {
  /** Number of resamples (default 2000). */
  resamples?: number;
  /** PRNG seed (default 90024). */
  seed?: number;
  /** Confidence level (default 0.95). */
  level?: number;
}

export const BOOTSTRAP_DEFAULTS = { resamples: 2000, seed: 90024, level: 0.95 } as const;

export function resolveBootstrap(opts: BootstrapOptions = {}) {
  return {
    resamples: opts.resamples ?? BOOTSTRAP_DEFAULTS.resamples,
    seed: opts.seed ?? BOOTSTRAP_DEFAULTS.seed,
    level: opts.level ?? BOOTSTRAP_DEFAULTS.level,
  };
}

/** `count` indices drawn uniformly with replacement from 0..n-1. */
export function resampleIndices(n: number, count: number, rng: Rng): number[] {
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) out[i] = Math.floor(rng.next() * n);
  return out;
}

/**
 * Percentile interval of bootstrap replicates (type-7 quantiles at
 * (1 - level) / 2 and (1 + level) / 2). Non-finite replicates are kept in
 * the ordering (+Infinity sorts last), so an unbounded upper end shows up as
 * Infinity rather than being silently dropped; NaN replicates are dropped.
 */
export function percentileInterval(replicates: readonly number[], level: number): [number, number] {
  const sorted = replicates.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [NaN, NaN];
  const a = (1 - level) / 2;
  const q = (p: number) => {
    // Interpolating between a finite value and Infinity gives Infinity; make
    // that explicit and avoid Infinity - Infinity = NaN.
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.min(sorted.length - 1, lo + 1);
    if (!Number.isFinite(sorted[lo]) || !Number.isFinite(sorted[hi]))
      return h === lo ? sorted[lo] : sorted[hi];
    return quantileSorted(sorted, p);
  };
  return [q(a), q(1 - a)];
}

/** Percentile bootstrap interval for `stat` over i.i.d. observations. */
export function bootstrapInterval(
  xs: readonly number[],
  stat: (sample: readonly number[]) => number,
  opts: BootstrapOptions = {},
): Interval {
  const { resamples, seed, level } = resolveBootstrap(opts);
  const estimate = stat(xs);
  if (xs.length === 0) return { estimate, lo: NaN, hi: NaN, level };
  const rng = createRng(seed);
  const reps = new Array<number>(resamples);
  const buf = new Array<number>(xs.length);
  for (let b = 0; b < resamples; b++) {
    const idx = resampleIndices(xs.length, xs.length, rng);
    for (let i = 0; i < idx.length; i++) buf[i] = xs[idx[i]];
    reps[b] = stat(buf);
  }
  const [lo, hi] = percentileInterval(reps, level);
  return { estimate, lo, hi, level };
}
