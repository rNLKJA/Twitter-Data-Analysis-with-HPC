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

/**
 * Gustafson's law (scaled speedup): if a fraction s of the time on n workers
 * is serial and the parallel part grows with n (a bigger problem in the same
 * time), the speedup over one worker is S(n) = n - s (n - 1). It answers a
 * different question from Amdahl's law (weak rather than strong scaling), so
 * it is drawn for contrast, not fitted.
 */
export function gustafsonSpeedup(s: number, n: number): number {
  return n - s * (n - 1);
}

/**
 * Range of the serial fraction implied by rounding alone, for timings that
 * were recorded to `resolution` seconds (Slurm's hh:mm:ss): each time could
 * be up to resolution / 2 either side of the printed value. This says
 * nothing about run-to-run variation, which one run per layout cannot show.
 */
export function serialFractionRoundingRange(
  t1: number,
  tn: number,
  n: number,
  resolution = 1,
): [number, number] {
  const h = resolution / 2;
  const f = (a: number, b: number) => Math.min(1, Math.max(0, karpFlatt(a / b, n)));
  // f rises as the speedup falls: smallest speedup = shortest t1, longest tn.
  return [f(t1 + h, tn - h), f(t1 - h, tn + h)];
}
