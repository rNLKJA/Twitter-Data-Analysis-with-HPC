/**
 * Tiny, dependency-free scale helpers for the hand-rolled SVG charts.
 */

export interface LinearScale {
  (value: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
  invert(px: number): number;
}

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as LinearScale;
  Object.assign(scale, {
    domain,
    range,
    invert: (px: number) => d0 + ((px - r0) / (r1 - r0 || 1)) * span,
  });
  return scale;
}

/** "Nice" step for roughly `count` ticks across [0, max] (1, 2, 2.5, 5 × 10^k). */
export function niceStep(max: number, count = 5): number {
  if (!(max > 0)) return 1;
  const raw = max / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/** Ticks from 0 up to (and including) the first nice value >= max. */
export function niceTicks(max: number, count = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const step = niceStep(max, count);
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Integer ticks for a count axis that starts at 1 (workers): 1, then multiples of a whole step. */
export function countTicks(max: number, count = 5): number[] {
  const step = Math.max(1, Math.floor(niceStep(max, count)));
  const ticks = [1];
  for (let v = step; v <= max; v += step) if (v > 1) ticks.push(v);
  return ticks;
}

/** Clock-friendly steps in seconds: sub-second steps for the browser lab, minutes and hours for Spartan. */
const TIME_STEPS = [
  0.001, 0.002, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120,
  180, 300, 600, 900, 1200, 1800, 3600, 7200,
];

/** Ticks for a duration axis in seconds, on clock-friendly steps (…, 0.1 s, …, 1, 2, 3, 5, 10 min, …). */
export function niceTimeTicks(maxSeconds: number, count = 5): number[] {
  if (!(maxSeconds > 0)) return [0, 1];
  const raw = maxSeconds / Math.max(1, count);
  const step = TIME_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 3600) * 3600;
  const steps = Math.ceil(maxSeconds / step - 1e-9);
  // Multiply rather than accumulate, so 0.05-second steps stay exact enough to print.
  return Array.from({ length: steps + 1 }, (_, i) => Number((i * step).toPrecision(12)));
}
