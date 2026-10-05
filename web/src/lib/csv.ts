/** Minimal RFC 4180 CSV writer (quotes fields that need it; nulls become empty). */
export type CsvValue = string | number | boolean | null | undefined;

/**
 * Text cells that a spreadsheet would read as a formula (=, +, -, @, or a
 * leading tab or carriage return). Model output and visitors' questions end
 * up in the exports, so such cells get a leading apostrophe, as OWASP
 * recommends for CSV injection. Numbers are written as numbers.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvField(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" && FORMULA_START.test(v) ? `'${v}` : String(v);
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
