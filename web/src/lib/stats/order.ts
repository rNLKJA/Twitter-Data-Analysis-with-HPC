import { median, sortedCopy } from "./descriptive";
import type { Interval } from "./interval";

/**
 * Distribution-free confidence interval for a median, from order statistics.
 *
 * For n independent draws from any continuous distribution, the interval
 * [x(k), x(n−k+1)] between the k-th smallest and k-th largest value covers
 * the population median with probability exactly 1 − 2·P(B ≤ k − 1), where
 * B ~ Binomial(n, 1/2). No shape is assumed, which matters for small samples
 * of wall times where a percentile bootstrap of the median under-covers.
 *
 * Because coverage moves in discrete steps, the interval is the narrowest one
 * whose coverage is at least `level`, and the coverage it actually has is
 * returned with it. When even [min, max] falls short (n ≤ 5 at 95%), the
 * result is [min, max] with its lower coverage, so callers can say so.
 */

/** P(B ≤ k) for B ~ Binomial(n, 1/2), exact for the small n used here. */
export function binomHalfCdf(k: number, n: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let term = 1; // C(n, 0)
  let sum = 1;
  for (let i = 1; i <= k; i++) {
    term = (term * (n - i + 1)) / i;
    sum += term;
  }
  return sum / 2 ** n;
}

/** Coverage of [x(k), x(n−k+1)] for the median of n draws. */
export function orderStatCoverage(k: number, n: number): number {
  return 1 - 2 * binomHalfCdf(k - 1, n);
}

export interface MedianInterval extends Interval {
  /** Exact coverage of the interval returned (at least `level` unless n is too small). */
  coverage: number;
  /** 1-based ranks of the order statistics used, [k, n − k + 1]. */
  ranks: [number, number];
}

export function medianInterval(xs: readonly number[], level = 0.95): MedianInterval {
  const n = xs.length;
  if (n === 0) return { estimate: NaN, lo: NaN, hi: NaN, level, coverage: NaN, ranks: [0, 0] };
  const sorted = sortedCopy(xs);
  let k = 1;
  while (k + 1 <= Math.floor((n + 1) / 2) && orderStatCoverage(k + 1, n) >= level) k++;
  return {
    estimate: median(xs),
    lo: sorted[k - 1],
    hi: sorted[n - k],
    level,
    coverage: n === 1 ? 0 : orderStatCoverage(k, n),
    ranks: [k, n - k + 1],
  };
}
