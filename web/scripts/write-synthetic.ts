/**
 * Write a seeded synthetic bigTwitter-shaped file (same generator as the web app).
 *
 *   pnpm tsx scripts/write-synthetic.ts --seed 2023 --tweets 400 --out ../scripts/.cache/synthetic.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { generateSyntheticFile } from "../src/lib/synth/generator";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const seed = Number(arg("seed", "90024"));
const tweets = Number(arg("tweets", "1000"));
const out = resolve(arg("out", `synthetic-${seed}-${tweets}.json`));

const bytes = generateSyntheticFile({ seed, tweets });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, bytes);
console.log(`wrote ${bytes.length} bytes (${tweets} tweets, seed ${seed}) to ${out}`);
