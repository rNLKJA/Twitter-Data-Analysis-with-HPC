/**
 * Scaling arithmetic used by the Scaling lab and the in-browser MPI lab.
 *
 * Amdahl's law: with a serial fraction f, the best speedup on n workers is
 *   S(n) = 1 / (f + (1 - f) / n)
 * Rearranged for a measured speedup this is the Karp–Flatt metric
 *   e = (1/S - 1/n) / (1 - 1/n)
 */

export function speedup(t1: number, tn: number): number {
  return t1 / tn;
}

export function efficiency(s: number, n: number): number {
  return s / n;
}

export function amdahlSpeedup(f: number, n: number): number {
  return 1 / (f + (1 - f) / n);
}

export function amdahlTime(t1: number, f: number, n: number): number {
  return t1 * (f + (1 - f) / n);
}

/** Upper bound on speedup as n → ∞. */
export function amdahlLimit(f: number): number {
  return f <= 0 ? Infinity : 1 / f;
}

/** Karp–Flatt experimentally determined serial fraction. */
export function karpFlatt(s: number, n: number): number {
  if (n <= 1) return NaN;
  return (1 / s - 1 / n) / (1 - 1 / n);
}

export interface ScalingPoint {
  n: number;
  /** measured speedup relative to n = 1 */
  s: number;
}

/**
 * Least-squares serial fraction for a set of (n, S) measurements, fitting
 * 1/S - 1/n = f (1 - 1/n) through the origin. Points with n = 1 carry no
 * information and are ignored. Result is clamped to [0, 1].
 */
export function fitSerialFraction(points: readonly ScalingPoint[]): number {
  let sxy = 0;
  let sxx = 0;
  for (const { n, s } of points) {
    if (n <= 1 || !(s > 0)) continue;
    const x = 1 - 1 / n;
    const y = 1 / s - 1 / n;
    sxy += x * y;
    sxx += x * x;
  }
  if (sxx === 0) return 0;
  return Math.min(1, Math.max(0, sxy / sxx));
}
