/**
 * Checking the arithmetic a model shows in its "calculation" field.
 *
 * A calculation is free text such as
 *   "2,218,689 + 2,284,909 = 4,503,598"
 *   "Speedup = 11:01 / 1:41 = 661 / 101 ≈ 6.54; 6.54 / 8 = 0.818 = 81.8%"
 * It is split into statements (on ";", new lines, ": " and ", " before a
 * word), each statement into sides (on "=", "≈"), and every side that reads
 * as arithmetic is evaluated. Words, units and labels such as "T1" or "S(8)"
 * are ignored. A statement is checked only if at least one side has an
 * operator; a bare number on another side must then equal it, allowing for
 * the rounding shown (6.54 for 6.5446, 81.8% for 0.8181).
 *
 * Every operand must come from somewhere: a cited row, a result already
 * checked earlier in the same calculation, or a unit constant (100, 60, …).
 * Only results whose operands all trace and whose arithmetic holds count as
 * "derived" numbers the answer may quote.
 */
import type { FoundNumber } from "./numbers";

/** A number as written in the calculation. */
export interface CalcNumber {
  value: number;
  /** Digits after the decimal point as written (0 for integers and clock times). */
  decimals: number;
  percent: boolean;
  text: string;
}

export interface CalculationCheck {
  /** Statements whose arithmetic does not hold, as written. */
  arithmeticErrors: string[];
  /** Operands found neither in the cited rows nor earlier in the calculation. */
  unverifiedInputs: string[];
  /** Results of statements that hold and whose operands all trace (exact and as written). */
  derived: CalcNumber[];
}

/** Unit conversions and small counts a calculation may use without a source. */
const CONSTANTS = new Set([100, 1000, 60, 3600]);
const isConstant = (n: CalcNumber) =>
  CONSTANTS.has(n.value) || (Number.isInteger(n.value) && n.value >= 0 && n.value < 10);

type Token =
  | { kind: "num"; n: CalcNumber }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lp" }
  | { kind: "rp" };

const ROW_ID = /\b[DTB]\d?\.\d+\b/g;
/** A label applied like a function, e.g. "S(8)" or "T(1)": dropped with its argument. */
const FUNCTION_LABEL = /\b[A-Za-z_][A-Za-z0-9_]*\([^()]*\)/g;
/** A count inside a hyphenated label, e.g. the 8 in "8-core" or "2-node". */
const HYPHEN_LABEL = /\b\d+-(?=[A-Za-z])/g;
const STATEMENT_SPLIT = /;|\n|:\s+|,\s+(?=[A-Za-z(])/;
const SIDE_SPLIT = /≈|~=|≃|=/;

function tokenize(side: string): Token[] {
  const out: Token[] = [];
  const re =
    /(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(\s*%)?|([A-Za-z_][A-Za-z0-9_]*)|([+\-−–×*÷/])|(\()|(\))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(side))) {
    if (m[1] !== undefined) {
      const seconds =
        m[3] === undefined
          ? Number(m[1]) * 60 + Number(m[2])
          : Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      out.push({ kind: "num", n: { value: seconds, decimals: 0, percent: false, text: m[0] } });
    } else if (m[4] !== undefined) {
      const raw = m[4].replace(/,/g, "");
      out.push({
        kind: "num",
        n: {
          value: Number(raw),
          decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
          percent: m[5] !== undefined,
          text: m[0].trim(),
        },
      });
    } else if (m[6] !== undefined) {
      // A lone "x" between two operands is a multiplication sign; other words are labels or units.
      const prev = out.at(-1);
      const rest = side.slice(re.lastIndex);
      if (
        /^[xX]$/.test(m[6]) &&
        (prev?.kind === "num" || prev?.kind === "rp") &&
        /^\s*[\d(.]/.test(rest)
      ) {
        out.push({ kind: "op", op: "*" });
      }
    } else if (m[7] !== undefined) {
      const c = m[7];
      out.push({
        kind: "op",
        op: c === "+" ? "+" : c === "×" || c === "*" ? "*" : c === "÷" || c === "/" ? "/" : "-",
      });
    } else if (m[8] !== undefined) out.push({ kind: "lp" });
    else if (m[9] !== undefined) out.push({ kind: "rp" });
  }
  // A trailing "×" (as in "6.54×") or a leading "/" is a unit or a fragment, not an operator.
  while (out.length && out.at(-1)!.kind === "op") out.pop();
  while (out.length && out[0].kind === "op" && (out[0] as { op: string }).op !== "-") out.shift();
  return out;
}

/** Recursive-descent evaluation; null if the tokens are not one well-formed expression. */
function evaluate(tokens: Token[]): number | null {
  let i = 0;
  const peek = () => tokens[i];
  function factor(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === "op" && t.op === "-") {
      i++;
      const v = factor();
      return v === null ? null : -v;
    }
    if (t.kind === "num") {
      i++;
      return t.n.value;
    }
    if (t.kind === "lp") {
      i++;
      const v = expr();
      if (v === null || peek()?.kind !== "rp") return null;
      i++;
      return v;
    }
    return null;
  }
  function term(): number | null {
    let v = factor();
    while (v !== null) {
      const t = peek();
      if (t?.kind !== "op" || (t.op !== "*" && t.op !== "/")) break;
      i++;
      const r = factor();
      if (r === null) return null;
      v = t.op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number | null {
    let v = term();
    while (v !== null) {
      const t = peek();
      if (t?.kind !== "op" || (t.op !== "+" && t.op !== "-")) break;
      i++;
      const r = term();
      if (r === null) return null;
      v = t.op === "+" ? v + r : v - r;
    }
    return v;
  }
  const v = expr();
  return v !== null && i === tokens.length && Number.isFinite(v) ? v : null;
}

interface Side {
  text: string;
  value: number;
  /** Has at least one binary operator (so it is arithmetic, not a bare number). */
  computed: boolean;
  numbers: CalcNumber[];
}

function readSide(text: string): Side | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const value = evaluate(tokens);
  if (value === null) return null;
  const numbers = tokens.flatMap((t) => (t.kind === "num" ? [t.n] : []));
  const computed = tokens.some(
    (t, k) =>
      t.kind === "op" && k > 0 && (tokens[k - 1].kind === "num" || tokens[k - 1].kind === "rp"),
  );
  return { text: text.trim(), value, computed, numbers };
}

/** Does a number as written equal `exact`, allowing for the rounding shown (and for "%")? */
export function showsValue(
  n: { value: number; decimals: number; percent?: boolean },
  exact: number,
) {
  const tol = 0.5 * 10 ** -n.decimals * (1 + 1e-9) + 1e-12 * Math.abs(exact);
  if (Math.abs(n.value - exact) <= tol) return true;
  return !!n.percent && Math.abs(n.value / 100 - exact) <= tol / 100;
}

/** Two computed sides agree (they may round intermediate values differently). */
const agree = (a: number, b: number) =>
  Math.abs(a - b) <= 5e-3 * Math.max(Math.abs(a), Math.abs(b));

export function checkCalculation(
  calculation: string,
  /** Numbers in the cited rows. */
  sources: readonly FoundNumber[],
  traces: (shown: FoundNumber, source: FoundNumber) => boolean,
): CalculationCheck {
  const arithmeticErrors: string[] = [];
  const unverifiedInputs: string[] = [];
  const derived: CalcNumber[] = [];

  const asFound = (n: CalcNumber): FoundNumber => ({
    value: n.value,
    digits: n.decimals === 0 && Number.isInteger(n.value) ? String(Math.abs(n.value)) : null,
    decimals: n.decimals,
    text: n.text,
  });
  const traced = (n: CalcNumber) =>
    isConstant(n) ||
    sources.some((s) => traces(asFound(n), s)) ||
    derived.some((d) => showsValue(n, d.value)) ||
    (n.percent &&
      derived.some((d) => showsValue({ ...n, value: n.value / 100, percent: false }, d.value)));

  const text = calculation
    .replace(ROW_ID, " ")
    .replace(FUNCTION_LABEL, " ")
    .replace(HYPHEN_LABEL, " ");
  for (const statement of text.split(STATEMENT_SPLIT)) {
    const sides = statement
      .split(SIDE_SPLIT)
      .map(readSide)
      .filter((s): s is Side => s !== null);
    const first = sides.find((s) => s.computed);
    if (!first) continue; // no arithmetic to check (a label, or a unit conversion)

    let ref = first.value;
    let ok = true;
    let inputsOk = true;
    let seenComputed = false;
    const results: CalcNumber[] = [];
    for (const side of sides) {
      if (side.computed) {
        seenComputed = true;
        if (side !== first) {
          const continues =
            side.numbers.length > 0 && showsValue(side.numbers[0], ref) && !agree(side.value, ref);
          if (!agree(side.value, ref) && !continues) ok = false;
        }
        for (const [k, n] of side.numbers.entries()) {
          // In "661 / 101 = 6.54 / 8", the 6.54 continues the previous result.
          const isCarried = side !== first && k === 0 && showsValue(n, ref);
          if (!isCarried && !traced(n)) {
            inputsOk = false;
            unverifiedInputs.push(n.text);
          }
        }
        ref = side.value;
        results.push({ value: side.value, decimals: 12, percent: false, text: side.text });
      } else {
        const [n] = side.numbers;
        if (showsValue(n, ref)) results.push(n);
        // Before any arithmetic a bare number is a label ("speedup (8 cores) = …") unless it
        // matches; after it, a bare number is the stated result and must match.
        else if (seenComputed) ok = false;
      }
    }
    if (!ok) arithmeticErrors.push(statement.trim());
    else if (inputsOk) derived.push(...results);
  }

  return {
    arithmeticErrors,
    unverifiedInputs: [...new Set(unverifiedInputs)],
    derived,
  };
}
