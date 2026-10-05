import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import gazetteer from "../../../public/data/gazetteer.json";
import boundaryFixture from "../__fixtures__/parity-boundary-2023-400.json";
import fixture from "../__fixtures__/parity-synthetic-2023-400.json";
import { generateSyntheticFile } from "../synth/generator";
import { resolveLocation } from "./normalise";
import { runPipeline } from "./pipeline";
import { task1Csv, task2Csv, task31Csv, task3Csv } from "./tasks";

/**
 * Parity with the ORIGINAL Python.
 *
 * __fixtures__/parity-synthetic-2023-400.json was produced by
 *   pnpm tsx scripts/write-synthetic.ts --seed 2023 --tweets 400 --out F
 *   uv run ../scripts/run_original.py --twitter F --sal sal.json --ranks 1 3 4 7 --records --out …
 * i.e. coursework/scripts/* unchanged, with the FULL sal.json. Here the same
 * file is regenerated and processed by the TypeScript port using only the
 * published gazetteer subset.
 */

type Csv = string[][];
type Run = {
  ranks: unknown[];
  task1: Csv;
  task2: Csv;
  task3: Csv;
  task3_1: Csv;
  records?: unknown[][];
};
const runs = fixture.runs as Record<string, Run>;
const dict = new Map(Object.entries(gazetteer.dict as Record<string, string>));
const bytes = generateSyntheticFile({ seed: 2023, tweets: 400 });

/**
 * polars' hash group-by leaves the order of one author's equally-counted
 * cities unspecified (it even differs between the Python runs with 1, 4 and 7
 * ranks), so Task 3 strings are compared with tied segments sorted.
 */
function canonicalTask3(text: string): string {
  const m = /^(\d+) \(#(\d+) tweets - (.*)\)$/.exec(text);
  if (!m) return text;
  const segs = m[3].split(", ").map((s) => {
    const [, n, g] = /^#(\d+)(.*)$/.exec(s)!;
    return { n: Number(n), g };
  });
  segs.sort((a, b) => b.n - a.n || a.g.localeCompare(b.g));
  return `${m[1]} (#${m[2]} tweets - ${segs.map((s) => `#${s.n}${s.g}`).join(", ")})`;
}

function canonicalTask31(rows: Csv): string[] {
  return rows
    .slice(1)
    .map((r) => r.join("|"))
    .sort();
}

describe("parity with the original Python pipeline", () => {
  it("regenerates the exact synthetic input the fixture was computed from", () => {
    expect(bytes.length).toBe(fixture.input.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.input.sha256);
  });

  it.each(Object.keys(runs))("matches the original on %s rank(s)", (size) => {
    const expected = runs[size];
    const got = runPipeline(bytes, dict, Number(size), { keepFrame: true });

    expect(got.ranks).toEqual(expected.ranks);
    expect(task1Csv(got.task1)).toEqual(expected.task1);
    expect(task2Csv(got.task2)).toEqual(expected.task2);

    const t3 = task3Csv(got.task3.rows);
    expect(t3.map((r) => [r[0], r[1], canonicalTask3(r[2])])).toEqual(
      expected.task3.map((r) => [r[0], r[1], canonicalTask3(r[2])]),
    );
    expect(canonicalTask31(task31Csv(got.task3.detail))).toEqual(canonicalTask31(expected.task3_1));

    if (expected.records) {
      const f = got.frame!;
      const records = f.tweetId.map((id, i) => [id, f.authorId[i], f.location[i], f.gcc[i]]);
      expect(records).toEqual(expected.records);
    }
  });
});

/**
 * A latent bug in the original, found while porting: when a chunk boundary
 * lands inside the four-space indentation before `"_id"`, the next rank's
 * first (partial) line still matches TWEETS_ID, while the previous rank reads
 * that whole line because it started before chunk_end. Both ranks count the
 * tweet. parity-boundary-2023-400.json is the ORIGINAL Python on the same
 * 400-tweet file with 27 and 39 ranks (one such boundary each): it reads 401
 * tweets. The port must do exactly the same, not quietly fix it.
 */
describe("parity on the original's chunk-boundary double count", () => {
  const runs = boundaryFixture.runs as Record<string, Run & { ranks: Array<{ tweets: number }> }>;

  it("uses the same input file", () => {
    expect(boundaryFixture.input.sha256).toBe(fixture.input.sha256);
  });

  it.each(Object.keys(runs))("matches the original on %s ranks, double count included", (size) => {
    const expected = runs[size];
    const got = runPipeline(bytes, dict, Number(size));
    expect(got.ranks).toEqual(expected.ranks);
    expect(got.ranks.reduce((s, r) => s + r.tweets, 0)).toBe(401);
    expect(task1Csv(got.task1)).toEqual(expected.task1);
    expect(task2Csv(got.task2)).toEqual(expected.task2);
    expect(task3Csv(got.task3.rows).map((r) => [r[0], r[1], canonicalTask3(r[2])])).toEqual(
      expected.task3.map((r) => [r[0], r[1], canonicalTask3(r[2])]),
    );
  });
});

describe("published gazetteer subset", () => {
  it.each(gazetteer.places.map((p) => [p.name, p] as const))(
    "%s resolves exactly as the original resolved it against the full sal.json",
    (name, expected) => {
      expect(resolveLocation(name, dict)).toEqual({
        location: expected.location,
        gcc: expected.gcc,
        matchedBy: expected.matchedBy,
        tried: expected.tried,
      });
    },
  );
});
