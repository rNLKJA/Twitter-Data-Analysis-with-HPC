import { describe, expect, it } from "vitest";

import gazetteer from "../../../public/data/gazetteer.json";
import { generateSyntheticFile } from "../synth/generator";
import { MemoryByteFile } from "./byte-file";
import { SKIP_AFTER_ID, SKIP_LINES_1, SKIP_LINES_2 } from "./constants";
import { twitterProcessorV1 } from "./processor";
import { traceScanner } from "./trace";

const dict = new Map(Object.entries(gazetteer.dict as Record<string, string>));

describe("traceScanner", () => {
  const bytes = generateSyntheticFile({ seed: 2023, tweets: 40 });
  const text = new TextDecoder().decode(bytes);
  const full = twitterProcessorV1(new MemoryByteFile(bytes), 0, bytes.length, dict).frame;

  it.each([1, 3, 40])("extracts the same first %i record(s) as twitterProcessorV1", (k) => {
    const { records } = traceScanner(text, dict, k);
    expect(records).toHaveLength(k);
    expect(records).toEqual(
      full.tweetId.slice(0, k).map((tweetId, i) => ({
        tweetId,
        authorId: full.authorId[i],
        location: full.location[i],
        gcc: full.gcc[i],
      })),
    );
  });

  it("skips exactly 2 / 18 / 20 lines after each kind of hit", () => {
    const { lines } = traceScanner(text, dict, 2);
    for (let i = 0; i < lines.length; i++) {
      for (const hit of lines[i].hits) {
        const expected =
          hit.kind === "id" ? SKIP_AFTER_ID : hit.kind === "author" ? SKIP_LINES_1 : SKIP_LINES_2;
        expect(hit.skip).toBe(expected);
      }
      if (lines[i].hits.length === 1) {
        const following = lines.slice(i + 1, i + 1 + lines[i].hits[0].skip);
        expect(following.every((l) => l.mode === "skip")).toBe(true);
      }
    }
  });

  it("numbers lines contiguously from 1", () => {
    const { lines, readCount, skipCount } = traceScanner(text, dict, 2);
    expect(lines.map((l) => l.n)).toEqual(lines.map((_, i) => i + 1));
    expect(readCount + skipCount).toBe(lines.length);
  });
});
