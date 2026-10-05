import { describe, expect, it } from "vitest";

import gazetteer from "../../../public/data/gazetteer.json";
import { generateSyntheticFile } from "../synth/generator";
import { idIndentBoundaryRanks, isIdIndentBoundary } from "./boundary";
import { splitFileIntoChunks } from "./chunks";
import { runPipeline } from "./pipeline";

const te = new TextEncoder();
const dict = new Map(Object.entries(gazetteer.dict as Record<string, string>));

describe("isIdIndentBoundary", () => {
  const text = '  {\n    "_id": "1444745498920984554",\n    "_rev": "1-abc",\n';
  const bytes = te.encode(text);
  const idLine = text.indexOf('    "_id"');

  it.each([1, 2, 3, 4])("flags a cut %i byte(s) into the indentation", (k) => {
    expect(isIdIndentBoundary(bytes, idLine + k)).toBe(true);
  });

  it.each([0, 5, 6, 12])("does not flag a cut %i bytes into the line", (k) => {
    expect(isIdIndentBoundary(bytes, idLine + k)).toBe(false);
  });

  it("ignores other lines and needs to see the line start", () => {
    const rev = text.indexOf('    "_rev"');
    expect(isIdIndentBoundary(bytes, rev + 2)).toBe(false);
    expect(isIdIndentBoundary(bytes.subarray(idLine + 1), 2)).toBe(false);
    expect(isIdIndentBoundary(bytes.subarray(idLine), 2, true)).toBe(true);
  });
});

describe("idIndentBoundaryRanks predicts the extra tweets exactly", () => {
  const bytes = generateSyntheticFile({ seed: 2023, tweets: 400 });

  it.each([3, 4, 7, 8, 16, 27, 39, 40, 41, 64])("for %i ranks", (n) => {
    const { start } = splitFileIntoChunks(bytes.length, n);
    const flagged = idIndentBoundaryRanks(bytes, start);
    const read = runPipeline(bytes, dict, n).ranks.reduce((s, r) => s + r.tweets, 0);
    expect(read - 400).toBe(flagged.length);
  });

  it("finds the boundary used by the parity fixture (27 ranks → rank 23)", () => {
    expect(idIndentBoundaryRanks(bytes, splitFileIntoChunks(bytes.length, 27).start)).toEqual([23]);
  });
});
