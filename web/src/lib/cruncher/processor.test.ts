import { describe, expect, it } from "vitest";

import { generateSyntheticFile } from "../synth/generator";
import { MemoryByteFile, PagedByteFile } from "./byte-file";
import { splitFileIntoChunks } from "./chunks";
import { twitterProcessorV1, UnbalancedChunkError } from "./processor";

const dict = new Map([
  ["sydney", "1gsyd"],
  ["melbourne", "2gmel"],
  ["brisbane", "3gbri"],
  ["gold coast", "3rqld"],
]);

const bytes = generateSyntheticFile({ seed: 7, tweets: 300 });
const encoder = new TextEncoder();

describe("twitterProcessorV1 byte-range semantics", () => {
  const whole = twitterProcessorV1(new MemoryByteFile(bytes), 0, bytes.length, dict).frame;

  it("reads every tweet in a single-rank run", () => {
    expect(whole.tweetId).toHaveLength(300);
    expect(new Set(whole.tweetId).size).toBe(300);
  });

  it.each([3, 4, 5, 7, 8, 12, 16, 31])("counts each tweet exactly once across %i ranks", (size) => {
    const { start, end } = splitFileIntoChunks(bytes.length, size);
    const ids: string[] = [];
    const gccs: Array<string | null> = [];
    for (let r = 0; r < start.length; r++) {
      const { frame } = twitterProcessorV1(new MemoryByteFile(bytes), start[r], end[r], dict);
      ids.push(...frame.tweetId);
      gccs.push(...frame.gcc);
    }
    expect(ids).toEqual(whole.tweetId);
    expect(gccs).toEqual(whole.gcc);
  });

  it("reads past the chunk end to finish its last tweet", () => {
    const { start, end } = splitFileIntoChunks(bytes.length, 4);
    const { stats } = twitterProcessorV1(new MemoryByteFile(bytes), start[0], end[0], dict);
    expect(stats.stoppedAt).toBeGreaterThanOrEqual(end[0]);
  });

  it("skips 2 + 18 + 20 lines per tweet, like the magic numbers", () => {
    const { stats } = twitterProcessorV1(new MemoryByteFile(bytes), 0, bytes.length, dict);
    expect(stats.linesSkipped).toBe(300 * 40);
  });

  it("gives identical results through the paged reader (tiny pages force refills)", () => {
    const paged = new PagedByteFile(bytes.length, (s, e) => bytes.slice(s, e), 97);
    const { frame } = twitterProcessorV1(paged, 0, bytes.length, dict);
    expect(frame).toEqual(whole);
  });

  it("throws instead of looping forever when a tweet never gets a location", () => {
    const broken = encoder.encode(
      '[\n  {\n    "_id": "1",\n    "_rev": "x",\n    "data": {\n      "author_id": "2"\n    }\n  }\n]\n',
    );
    expect(() => twitterProcessorV1(new MemoryByteFile(broken), 0, broken.length, dict)).toThrow(
      UnbalancedChunkError,
    );
  });

  it("reports progress", () => {
    const seen: number[] = [];
    twitterProcessorV1(new MemoryByteFile(bytes), 0, bytes.length, dict, {
      progressEvery: 1000,
      onProgress: (p) => seen.push(p.bytesRead),
    });
    expect(seen.length).toBeGreaterThan(3);
    expect(seen.at(-1)).toBe(bytes.length);
  });
});
