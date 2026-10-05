import { describe, expect, it } from "vitest";

import { SKIP_LINES_1, SKIP_LINES_2 } from "../cruncher/constants";
import { generateSyntheticFile, PLACES } from "./generator";

const decoder = new TextDecoder();

describe("synthetic bigTwitter-shaped generator", () => {
  const bytes = generateSyntheticFile({ seed: 42, tweets: 250 });
  const text = decoder.decode(bytes);
  const lines = text.split("\n");

  it("is deterministic per seed", () => {
    expect(generateSyntheticFile({ seed: 42, tweets: 250 })).toEqual(bytes);
    expect(generateSyntheticFile({ seed: 43, tweets: 250 })).not.toEqual(bytes);
  });

  it("produces valid JSON with the CouchDB document shape", () => {
    const docs = JSON.parse(text) as Array<Record<string, unknown>>;
    expect(docs).toHaveLength(250);
    const first = docs[0] as {
      _id: string;
      _rev: string;
      data: { author_id: string };
      includes: { places: Array<{ full_name: string }> };
      matching_rules: unknown[];
    };
    expect(Object.keys(first)).toEqual(["_id", "_rev", "data", "includes", "matching_rules"]);
    expect(Object.keys(first.data)[0]).toBe("author_id");
    expect(first._id).toMatch(/^\d{19}$/);
    expect(PLACES.map((p) => p.name)).toContain(first.includes.places[0].full_name);
  });

  it("keeps the line layout the magic skip counts rely on", () => {
    let author = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('"author_id"')) author = i;
      if (lines[i].includes('"full_name"')) {
        expect(i - author - 1).toBeGreaterThanOrEqual(SKIP_LINES_1);
        // the 20 skipped lines end exactly where the tweet object closes
        expect(lines[i + SKIP_LINES_2 + 1]).toMatch(/^ {2}\}/);
      }
    }
  });

  it("is ASCII only, so byte-range splits can never cut a multi-byte character", () => {
    expect(bytes.every((b) => b < 0x80)).toBe(true);
  });
});
