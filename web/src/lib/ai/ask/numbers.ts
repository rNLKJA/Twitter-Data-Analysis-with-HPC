/**
 * Numbers mentioned in free text, for checking an answer against its cited
 * rows and against the evaluation's answer key. Clock times ("1:41",
 * "00:11:01") become seconds; "2,284,909" and "87.13%" become plain numbers;
 * row ids such as "T2.2" are ignored. Integers longer than 15 digits (author
 * ids) are also kept as digit strings, because a double cannot hold them.
 */

export interface FoundNumber {
  value: number;
  /** Digits only, for exact comparison of long integers. */
  digits: string | null;
  /** Digits after the decimal point as written (0 for integers and clock times). */
  decimals: number;
  text: string;
}

const ROW_ID = /\b[DTB]\d?\.\d+\b/g;
const CLOCK = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
const NUMBER = /(?<![\w.])-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\w])/g;

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

export function extractNumbers(text: string, { words = false } = {}): FoundNumber[] {
  const out: FoundNumber[] = [];
  let rest = text.replace(ROW_ID, " ");
  rest = rest.replace(CLOCK, (m, a: string, b: string, c: string | undefined) => {
    const seconds =
      c === undefined ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c);
    out.push({ value: seconds, digits: null, decimals: 0, text: m });
    return " ";
  });
  for (const m of rest.matchAll(NUMBER)) {
    const raw = m[0].replace(/,/g, "");
    const isInt = /^-?\d+$/.test(raw);
    out.push({
      value: Number(raw),
      digits: isInt ? raw.replace(/^-/, "") : null,
      decimals: isInt ? 0 : raw.split(".")[1].length,
      text: m[0],
    });
  }
  if (words) {
    for (const m of rest
      .toLowerCase()
      .matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)) {
      out.push({ value: WORDS[m[1]], digits: String(WORDS[m[1]]), decimals: 0, text: m[0] });
    }
  }
  return out;
}

/**
 * Could `shown` (a number in an answer) be `source` (a number in a row or a
 * calculation) as written? Whole numbers must match exactly (21,000 is not
 * 21,034); a decimal may be `source` rounded to the decimals shown (87.1 for
 * 87.13).
 */
export function tracesTo(shown: FoundNumber, source: FoundNumber): boolean {
  if (shown.digits && source.digits && (shown.digits.length > 15 || source.digits.length > 15)) {
    return shown.digits === source.digits;
  }
  const tol = shown.decimals === 0 ? 1e-9 : 0.5 * 10 ** -shown.decimals + 1e-12;
  return (
    Math.abs(shown.value - source.value) <=
    tol * (shown.decimals === 0 ? Math.max(1, Math.abs(source.value)) : 1)
  );
}

/** Equal within a relative tolerance; long integers must match digit for digit. */
export function sameNumber(a: FoundNumber, b: FoundNumber, relTol = 1e-9): boolean {
  if (a.digits && b.digits && (a.digits.length > 15 || b.digits.length > 15)) {
    return a.digits === b.digits;
  }
  return Math.abs(a.value - b.value) <= relTol * Math.max(1, Math.abs(b.value));
}
