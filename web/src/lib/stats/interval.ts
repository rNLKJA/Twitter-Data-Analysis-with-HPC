/** A point estimate with a two-sided interval at `level` (e.g. 0.95). */
export interface Interval {
  estimate: number;
  lo: number;
  hi: number;
  level: number;
}

/** "3.2% (95% CI 2.1% to 4.0%)"-style text, with a formatter for the numbers. */
export function formatInterval(
  i: Interval,
  fmt: (v: number) => string,
  { showLevel = true }: { showLevel?: boolean } = {},
): string {
  const ci = `${showLevel ? `${Math.round(i.level * 100)}% CI ` : ""}${fmt(i.lo)} to ${fmt(i.hi)}`;
  return `${fmt(i.estimate)} (${ci})`;
}
