import { createRng } from "../synth/prng";
import {
  percentileInterval,
  resampleIndices,
  resolveBootstrap,
  type BootstrapOptions,
} from "./bootstrap";
import type { Interval } from "./interval";

/**
 * Paired comparison of two methods scored pass/fail on the same items.
 * Only the discordant items (one passes, the other fails) carry information
 * about the difference; McNemar's exact test uses exactly those.
 */

/** log(n choose k) via a running sum (n is small here: tens to hundreds). */
function logChoose(n: number, k: number): number {
  let s = 0;
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i);
  return s;
}

/**
 * Exact two-sided McNemar p-value: a binomial test of b successes out of
 * b + c at p = 1/2. Matches scipy.stats.binomtest(min(b, c), b + c).pvalue
 * and R's binom.test.
 */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

export interface PairedComparison {
  /** Items both methods were scored on. */
  n: number;
  /** A passed, B failed. */
  onlyA: number;
  /** B passed, A failed. */
  onlyB: number;
  bothPass: number;
  bothFail: number;
  /** Pass rate of A minus pass rate of B, with a paired bootstrap interval over items. */
  difference: Interval;
  /** Exact McNemar p-value on the discordant items. */
  p: number;
}

export function comparePaired(
  a: readonly boolean[],
  b: readonly boolean[],
  opts: BootstrapOptions = {},
): PairedComparison {
  if (a.length !== b.length) throw new RangeError("paired samples must have the same length");
  const { resamples, seed, level } = resolveBootstrap(opts);
  const n = a.length;
  let onlyA = 0;
  let onlyB = 0;
  let bothPass = 0;
  let bothFail = 0;
  const d = a.map((x, i) => (x ? 1 : 0) - (b[i] ? 1 : 0));
  for (let i = 0; i < n; i++) {
    if (a[i] && b[i]) bothPass++;
    else if (a[i]) onlyA++;
    else if (b[i]) onlyB++;
    else bothFail++;
  }
  const estimate = n === 0 ? NaN : (onlyA - onlyB) / n;
  let lo = NaN;
  let hi = NaN;
  if (n > 0) {
    const rng = createRng(seed);
    const reps = new Array<number>(resamples);
    for (let r = 0; r < resamples; r++) {
      let s = 0;
      for (const i of resampleIndices(n, n, rng)) s += d[i];
      reps[r] = s / n;
    }
    [lo, hi] = percentileInterval(reps, level);
  }
  return {
    n,
    onlyA,
    onlyB,
    bothPass,
    bothFail,
    difference: { estimate, lo, hi, level },
    p: mcnemarExact(onlyA, onlyB),
  };
}
