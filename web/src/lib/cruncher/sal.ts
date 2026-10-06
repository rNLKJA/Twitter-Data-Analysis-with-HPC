/**
 * Port of `sal_processor.process_salV1` followed by
 * `sal_dict = dict(zip(sal_df["location"], sal_df["gcc"]))` from main.py.
 *
 * Steps (all on the sal.json key, in file order):
 *   1. strip "(" and ")"
 *   2. replace " - " with " "
 *   3. remove "."
 *   4. for keys with more than two words, append every consecutive word pair
 *      (bigram) as an extra row with the same gcc — after *all* original rows.
 *
 * Building a dict from the concatenated rows means later rows overwrite
 * earlier ones, so a bigram such as "box hill" (from "box hill vic") can
 * override an original key. That precedence is reproduced exactly.
 */
export interface SalEntry {
  ste?: string;
  gcc: string;
  sal?: string;
}

function cleanLocation(location: string): string {
  let text = location.replace(/[()]/g, "");
  text = text.split(" - ").join(" ");
  text = text.replace(/\./g, "");
  return text;
}

function splitLocationIntoNgrams(location: string): string[] | null {
  const words = location.split(" ");
  if (words.length > 2) {
    const out: string[] = [];
    for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
    return out;
  }
  return null;
}

/** Accepts either the parsed sal.json object or an ordered list of entries. */
export function processSalV1(
  sal: Record<string, SalEntry> | ReadonlyArray<readonly [string, SalEntry]>,
): Map<string, string> {
  const entries: ReadonlyArray<readonly [string, SalEntry]> = Array.isArray(sal)
    ? (sal as ReadonlyArray<readonly [string, SalEntry]>)
    : Object.entries(sal as Record<string, SalEntry>);

  const rows: Array<[string, string]> = entries.map(([key, v]) => [cleanLocation(key), v.gcc]);
  const bigramRows: Array<[string, string]> = [];
  for (const [location, gcc] of rows) {
    const grams = splitLocationIntoNgrams(location);
    if (grams) for (const g of grams) bigramRows.push([g, gcc]);
  }

  const dict = new Map<string, string>();
  for (const [k, v] of rows) dict.set(k, v);
  for (const [k, v] of bigramRows) dict.set(k, v);
  return dict;
}
