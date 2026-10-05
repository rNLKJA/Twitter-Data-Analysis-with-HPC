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
const utf8 = new TextDecoder();
const MAX_FAST = 4096;

export function decodeLine(bytes: Uint8Array): string {
  const n = bytes.length;
  if (n === 0) return "";
  if (n <= MAX_FAST) {
    for (let i = 0; i < n; i++) {
      if (bytes[i] > 0x7f) return utf8.decode(bytes);
    }
    return String.fromCharCode.apply(null, bytes as unknown as number[]);
  }
  return utf8.decode(bytes);
}
