import { GCCS, INVALID_LOCATION, STATE_LOCATION } from "./constants";

/**
 * Python's Unicode `\w` is `str.isalnum()` plus `_`, i.e. letters (L*) and
 * numbers (N*). Python's `\s` additionally treats \x1c-\x1f and \x85 as
 * whitespace (JavaScript's `\s` does not, but adds ﻿), so both classes
 * are spelled out to keep `re.sub(r"[^\w\s]", "", ...)` byte-for-byte equal.
 */
const PY_WS =
  "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const NOT_WORD_OR_SPACE = new RegExp(`[^\\p{L}\\p{N}_${PY_WS}]`, "gu");
const MULTI_SPACE = / +/g;

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

/**
 * Port of `utils.normalise_location`.
 *
 * ```python
 * text = re.sub(r"[^\w\s]", "", location)
 * text = re.sub(r" - ", "", text)
 * if location.split(",")[0] in gccs:
 *     text = location.split(",")[0].lower()
 * for key, value in state_location.items():
 *     text = re.sub(key, value, text)
 * return re.sub(" +", " ", text)
 * ```
 *
 * The caller lower-cases the tweet's `full_name` first, so the capitalised
 * `gccs` check can never fire — that quirk is preserved deliberately.
 */
export function normaliseLocation(location: string): string {
  let text = location.replace(NOT_WORD_OR_SPACE, "");
  text = replaceAll(text, " - ", "");

  const head = location.split(",")[0];
  if (GCCS.includes(head)) {
    text = head.toLowerCase();
  }

  for (const [key, value] of STATE_LOCATION) {
    text = replaceAll(text, key, value);
  }

  return text.replace(MULTI_SPACE, " ");
}

/** Port of `utils.is_state_location`. */
export function isStateLocation(location: string): boolean {
  return INVALID_LOCATION.includes(location);
}

/**
 * Port of `twitter_processor.return_words_ngrams`:
 * `[" ".join(c) for i in range(1, len(words) + 1) for c in combinations(words, i)]`
 *
 * Yields lazily in exactly the same order as `itertools.combinations`
 * (shortest first, then lexicographic by index) so callers can stop at the
 * first dictionary hit, as the original `break` does.
 */
export function* wordNgrams(words: readonly string[]): Generator<string> {
  const n = words.length;
  for (let r = 1; r <= n; r++) {
    const idx = Array.from({ length: r }, (_, i) => i);
    while (true) {
      yield idx.map((i) => words[i]).join(" ");
      let i = r - 1;
      while (i >= 0 && idx[i] === i + n - r) i--;
      if (i < 0) break;
      idx[i]++;
      for (let j = i + 1; j < r; j++) idx[j] = idx[j - 1] + 1;
    }
  }
}

/** Eager variant, mirroring the Python list. */
export function returnWordsNgrams(words: readonly string[]): string[] {
  return Array.from(wordNgrams(words));
}

export type SalDict = ReadonlyMap<string, string>;

export interface Resolution {
  /** Lower-cased then normalised location string. */
  location: string;
  /** Matched GCC code, or null when no n-gram is in the gazetteer. */
  gcc: string | null;
  /** The n-gram that matched (first hit), if any. */
  matchedBy: string | null;
  /** How many n-grams were tried before the hit (or in total when unmatched). */
  tried: number;
}

/**
 * The location → GCC step inside `twitter_processorV1`:
 *
 * ```python
 * location = normalise_location(match_location.group(1).lower())
 * ngram_words = return_words_ngrams(location.split(" "))
 * for possible_location in ngram_words:
 *     if sal_dict.get(possible_location):
 *         gcc.append(sal_dict.get(possible_location)); break
 * ```
 */
export function resolveLocation(fullName: string, salDict: SalDict): Resolution {
  const location = normaliseLocation(fullName.toLowerCase());
  let tried = 0;
  for (const candidate of wordNgrams(location.split(" "))) {
    tried++;
    const gcc = salDict.get(candidate);
    if (gcc) return { location, gcc, matchedBy: candidate, tried };
  }
  return { location, gcc: null, matchedBy: null, tried };
}
