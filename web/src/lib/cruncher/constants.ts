/**
 * Constants ported verbatim from coursework/scripts/twitter_processor.py and
 * coursework/scripts/utils.py. Keep these in sync with the Python originals —
 * the parity tests depend on them.
 */

/** `TWEETS_ID = re.compile(r'"_id":\s*"([^"]+)"')` */
export const TWEETS_ID = /"_id":\s*"([^"]+)"/;
/** `AUTHOR_ID = re.compile(r'"author_id":\s*"([^"]+)"')` */
export const AUTHOR_ID = /"author_id":\s*"([^"]+)"/;
/** `LOCATION_ID = re.compile(r'"full_name":\s*"([^"]+)"')` */
export const LOCATION_ID = /"full_name":\s*"([^"]+)"/;

/** Lines skipped right after a `"_id"` match (`f.readline()` twice). */
export const SKIP_AFTER_ID = 2;
/** `SKIP_LINES_1 = 18  # MAGICS NUMBERS` — skipped after `"author_id"`. */
export const SKIP_LINES_1 = 18;
/** `SKIP_LINES_2 = 20` — skipped after `"full_name"`. */
export const SKIP_LINES_2 = 20;

/** `utils.state_location`: full state names → abbreviations (insertion order matters). */
export const STATE_LOCATION: ReadonlyArray<readonly [string, string]> = [
  ["australian capital territory", "act"],
  ["new south wales", "nsw"],
  ["northern territory", "nt"],
  ["queensland", "qld"],
  ["south australia", "sa"],
  ["tasmania", "tas"],
  ["victoria", "vic"],
  ["western australia", "wa"],
];

/** `utils.gccs` — note: capitalised, exactly as in the original. */
export const GCCS: ReadonlyArray<string> = [
  "Canberra",
  "Sydney",
  "Darwin",
  "Brisbane",
  "Adelaide",
  "Hobart",
  "Melbourne",
  "Perth",
];

/** `utils.INVALID_LOCATION` (kept for completeness; unused by the V1 pipeline). */
export const INVALID_LOCATION: ReadonlyArray<string> = [
  "act australia",
  "nsw australia",
  "nt australia",
  "qld Australia",
  "sa australia",
  "tas australia",
  "vic australia",
  "wa australia",
  "australia",
];

/** Rural GCC codes are filtered with polars `str.contains(r"\dr[a-z]{3}")`. */
export const RURAL_GCC = /\dr[a-z]{3}/;
