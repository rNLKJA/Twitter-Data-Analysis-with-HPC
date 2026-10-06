/**
 * `line.decode()` for the scanner: bytes → string, UTF-8.
 *
 * Chrome's TextDecoder serialises across threads: with 8 Web Workers each
 * decoding short lines it got ~6× slower than with one, which wiped out the
 * parallel speedup the lab is meant to show. Almost every line the scanner
 * reads is pure ASCII, and for ASCII `String.fromCharCode` yields exactly the
 * same string, so that is the fast path; anything else (or a very long line)
 * still goes through TextDecoder. decode.test.ts checks the two agree.
 */
const MAX_FAST = 4096;
const lenient = new TextDecoder();
/** Python's bytes.decode(): strict, and a leading BOM is kept as U+FEFF. */
const strict = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function asciiOrNull(bytes: Uint8Array): string | null {
  const n = bytes.length;
  if (n > MAX_FAST) return null;
  for (let i = 0; i < n; i++) {
    if (bytes[i] > 0x7f) return null;
  }
  return String.fromCharCode.apply(null, bytes as unknown as number[]);
}

/**
 * Lenient decode (invalid bytes become U+FFFD). For peeking at windows that
 * may start or end mid-character, e.g. the chunk-boundary check.
 */
export function decodeLine(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  return asciiOrNull(bytes) ?? lenient.decode(bytes);
}

/** What CPython raises for `bytes.decode()` on invalid UTF-8. */
export class UnicodeDecodeError extends Error {
  constructor(detail: string) {
    super(`UnicodeDecodeError: 'utf-8' codec ${detail}`);
    this.name = "UnicodeDecodeError";
  }
}

/**
 * Exactly `f.readline().decode()` as the original scanner calls it: strict
 * UTF-8, so a line that is not valid UTF-8 (typically a rank's first line
 * when its chunk starts inside a multi-byte character) throws
 * UnicodeDecodeError, as the 2023 code did before the MPI job aborted.
 */
export function decodeLineStrict(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const ascii = asciiOrNull(bytes);
  if (ascii !== null) return ascii;
  try {
    return strict.decode(bytes);
  } catch {
    throw new UnicodeDecodeError(describeUtf8Error(bytes));
  }
}

const hex = (b: number) => `0x${b.toString(16).padStart(2, "0")}`;

/** CPython's wording for the first invalid sequence ("can't decode byte 0xa9 in position 0: …"). */
export function describeUtf8Error(b: Uint8Array): string {
  let i = 0;
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) {
      i++;
      continue;
    }
    let need: number;
    let lo = 0x80;
    let hi = 0xbf;
    if (c >= 0xc2 && c <= 0xdf) need = 1;
    else if (c >= 0xe0 && c <= 0xef) {
      need = 2;
      if (c === 0xe0) lo = 0xa0;
      if (c === 0xed) hi = 0x9f;
    } else if (c >= 0xf0 && c <= 0xf4) {
      need = 3;
      if (c === 0xf0) lo = 0x90;
      if (c === 0xf4) hi = 0x8f;
    } else {
      return `can't decode byte ${hex(c)} in position ${i}: invalid start byte`;
    }
    for (let k = 1; k <= need; k++) {
      if (i + k >= b.length) {
        return i === b.length - 1
          ? `can't decode byte ${hex(c)} in position ${i}: unexpected end of data`
          : `can't decode bytes in position ${i}-${b.length - 1}: unexpected end of data`;
      }
      const d = b[i + k];
      if (d < (k === 1 ? lo : 0x80) || d > (k === 1 ? hi : 0xbf)) {
        return `can't decode byte ${hex(c)} in position ${i}: invalid continuation byte`;
      }
    }
    i += need + 1;
  }
  return "can't decode the line: invalid UTF-8";
}
