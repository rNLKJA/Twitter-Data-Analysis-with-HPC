/**
 * Descriptive statistics. Quantiles use R's default (type 7) and numpy's
 * default ("linear") definition, so results can be checked against either.
 */

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Quantile of already-sorted values (ascending), type 7. */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0 || !(p >= 0 && p <= 1)) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function sortedCopy(xs: readonly number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

/** Quantile, R type 7 / numpy "linear". */
export function quantile(xs: readonly number[], p: number): number {
  return quantileSorted(sortedCopy(xs), p);
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}
