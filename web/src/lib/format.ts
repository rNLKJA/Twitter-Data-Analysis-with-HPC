const intFmt = new Intl.NumberFormat("en-AU");
const pctFmt = new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 });

export function formatInt(n: number): string {
  return intFmt.format(Math.round(n));
}

export function formatPct(fraction: number, digits = 1): string {
  return digits === 1
    ? pctFmt.format(fraction)
    : new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: digits }).format(
        fraction,
      );
}

/** Compact counts: 9,092,274 → "9.09M". */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return formatInt(n);
}

/** Decimal (SI) byte sizes, as the assignment brief quotes them ("18.74 GB"). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

/** 661 → "11:01"; 3723 → "1:02:03". */
export function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** "00:11:01" (Slurm wall-clock) → 661. */
export function parseClock(hms: string): number {
  return hms.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
}

/** Milliseconds for live timings: 842 → "842 ms", 1520 → "1.52 s". */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}
