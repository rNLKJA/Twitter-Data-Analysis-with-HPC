/** Minimal RFC 4180 CSV writer (quotes fields that need it; nulls become empty). */
export type CsvValue = string | number | boolean | null | undefined;

export function csvField(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  rows: ReadonlyArray<Record<string, CsvValue>>,
  columns: readonly string[],
): string {
  const lines = [columns.map(csvField).join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvField(r[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
