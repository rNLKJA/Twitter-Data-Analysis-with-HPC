import { TWEETS_ID } from "./constants";
import { decodeLine } from "./decode";

/**
 * The one chunk boundary the original program gets wrong.
 *
 * `split_file_into_chunks` cuts at arbitrary bytes. If a cut lands inside the
 * leading indentation of an `"_id"` line (1 to 4 bytes into
 * `    "_id": "…",`), the next rank's first, partial line still contains the
 * whole `"_id": "…"` and matches TWEETS_ID, while the previous rank reads the
 * same line in full because it began before its chunk_end. Both ranks then
 * count that tweet. Verified against the original Python (see the boundary
 * parity fixture); the port reproduces it on purpose.
 *
 * `window` holds file bytes around the cut and `cut` is the cut's offset in
 * it. Pass `windowAtLineStart` when window[0] is the first byte of a line
 * (e.g. the file start); otherwise the window must include the newline that
 * precedes the cut's line, or the answer is `false`.
 */
export function isIdIndentBoundary(
  window: Uint8Array,
  cut: number,
  windowAtLineStart = false,
): boolean {
  if (cut <= 0 || cut >= window.length) return false;
  let lineStart = cut;
  while (lineStart > 0 && window[lineStart - 1] !== 0x0a) lineStart--;
  if (lineStart === 0 && !windowAtLineStart) return false; // line start not visible
  if (lineStart === cut) return false; // a cut exactly at a line start is handled correctly
  for (let i = lineStart; i < cut; i++) {
    if (window[i] !== 0x20 && window[i] !== 0x09) return false;
  }
  let lineEnd = window.indexOf(0x0a, cut);
  if (lineEnd === -1) lineEnd = window.length;
  return TWEETS_ID.test(decodeLine(window.subarray(cut, lineEnd)));
}

/** Bytes either side of a cut that are enough to decide (lines here are short). */
export const BOUNDARY_WINDOW = 512;

/** Ranks (>= 1) whose byte range starts at such a boundary, for an in-memory file. */
export function idIndentBoundaryRanks(bytes: Uint8Array, starts: readonly number[]): number[] {
  const out: number[] = [];
  for (let r = 1; r < starts.length; r++) {
    const from = Math.max(0, starts[r] - BOUNDARY_WINDOW);
    const to = Math.min(bytes.length, starts[r] + BOUNDARY_WINDOW);
    if (isIdIndentBoundary(bytes.subarray(from, to), starts[r] - from, from === 0)) out.push(r);
  }
  return out;
}
