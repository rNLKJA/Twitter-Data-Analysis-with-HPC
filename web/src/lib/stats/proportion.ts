import type { Interval } from "./interval";
import { zFor } from "./normal";

/**
 * Wilson score interval for a binomial proportion k / n (no continuity
 * correction; the same as statsmodels' `method="wilson"` and R's
 * `prop.test(k, n, correct = FALSE)$conf.int`).
 */
export function wilson(k: number, n: number, level = 0.95): Interval {
  if (!(n > 0) || k < 0 || k > n) return { estimate: NaN, lo: NaN, hi: NaN, level };
  const z = zFor(level);
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    estimate: p,
    lo: k === 0 ? 0 : Math.max(0, centre - half),
    hi: k === n ? 1 : Math.min(1, centre + half),
    level,
  };
}
