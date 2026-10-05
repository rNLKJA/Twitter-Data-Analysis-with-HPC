/**
 * Run the TypeScript port end to end on a Twitter JSON file and print the same
 * JSON shape as scripts/parity/run_original.py, so the two can be diffed.
 *
 *   pnpm tsx scripts/run-pipeline.ts --twitter FILE (--sal sal.json | --gazetteer gazetteer.json) \
 *       --ranks 1 3 4 8 --out out.json [--records] [--dump-sal-dict path]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { runPipeline } from "../src/lib/cruncher/pipeline";
import { processSalV1, type SalEntry } from "../src/lib/cruncher/sal";
import { task1Csv, task2Csv, task31Csv, task3Csv } from "../src/lib/cruncher/tasks";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
function args(name: string): string[] {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return [];
  const out: string[] = [];
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith("--"); j++)
    out.push(process.argv[j]);
  return out;
}

const twitterPath = resolve(arg("twitter") ?? "");
const salPath = arg("sal");
const gazPath = arg("gazetteer");
const outPath = resolve(arg("out") ?? "pipeline.json");
const ranks = (args("ranks").length ? args("ranks") : ["1"]).map(Number);

let salDict: Map<string, string>;
if (salPath) {
  const sal = JSON.parse(readFileSync(resolve(salPath), "utf8")) as Record<string, SalEntry>;
  salDict = processSalV1(sal);
} else if (gazPath) {
  const gaz = JSON.parse(readFileSync(resolve(gazPath), "utf8")) as {
    dict: Record<string, string>;
  };
  salDict = new Map(Object.entries(gaz.dict));
} else {
  throw new Error("pass --sal or --gazetteer");
}

const dumpSal = arg("dump-sal-dict");
if (dumpSal) {
  mkdirSync(dirname(resolve(dumpSal)), { recursive: true });
  writeFileSync(resolve(dumpSal), JSON.stringify(Object.fromEntries(salDict)));
}

const bytes = new Uint8Array(readFileSync(twitterPath));
const result: Record<string, unknown> = {
  input: {
    file: basename(twitterPath),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  },
  salDictSize: salDict.size,
  runs: {} as Record<string, unknown>,
};

for (const size of ranks) {
  if (size === 2) continue;
  const r = runPipeline(bytes, salDict, size, { keepFrame: process.argv.includes("--records") });
  const run: Record<string, unknown> = {
    ranks: r.ranks,
    task1: task1Csv(r.task1),
    task2: task2Csv(r.task2),
    task3: task3Csv(r.task3.rows),
    task3_1: task31Csv(r.task3.detail),
  };
  if (r.frame) {
    run.records = r.frame.tweetId.map((id, i) => [
      id,
      r.frame!.authorId[i],
      r.frame!.location[i],
      r.frame!.gcc[i],
    ]);
  }
  (result.runs as Record<string, unknown>)[String(size)] = run;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(result, null, 1));
console.log(`wrote ${outPath}`);
