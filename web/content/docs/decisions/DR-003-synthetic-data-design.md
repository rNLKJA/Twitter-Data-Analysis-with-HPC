# DR-003: A seeded synthetic file with bigTwitter.json's exact line layout

- **Decision:** the browser demo and the parity tests run on a generated file that copies the line layout of `bigTwitter.json` exactly, filled with made-up ids, text and places from a seeded generator, rather than on any real tweets.
- **Status:** accepted in October 2026 for the revival.
- **Supersedes:** nothing.

## Context

The course data cannot be published. It belongs to the course, and real tweets carry personal information. The original scanner does not parse JSON: it reads lines and skips a fixed number of them after each match (2 after `_id`, 18 after `author_id`, 20 after `full_name`). Any demo input therefore has to match the line layout, or the original algorithm would simply misread it. The demo also has to run in a browser in seconds, and its output has to be checkable against the original Python.

## Decision

`web/src/lib/synth/generator.ts` writes a two-space pretty-printed JSON array of CouchDB-style documents with the course data's field order: `_id`, `_rev`, `data` (with `author_id` first and `sentiment` last), `includes.places[0].full_name` and `matching_rules`. Every tweet keeps at least 18 lines between `author_id` and `full_name` and exactly 20 lines after `full_name`. The generator uses the mulberry32 PRNG, so the same seed always produces the same bytes. Its main choices:

| Choice     | Value                                                          | Why                                                      |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Authors    | tweets / 24, activity weight 1 / (i + 1)^0.85                  | a few very active accounts, as in Task 1                 |
| Author ids | 45% short numeric, the rest snowflake ids created 2012 to 2022 | both id styles appear in the published results           |
| Places     | a weighted, hand-written vocabulary of Australian place names  | names resolve through the real `sal.json` matching logic |
| Travellers | 5% of authors hop between 3 to 8 capitals, 45% of the time     | gives Task 3 something to find                           |
| Strays     | 7% of tweets come from a random place                          | some rural and unmatched places                          |
| Dates      | spread over 2021-07-05 to 2022-12-31                           | the period the real file covers                          |
| Text       | ASCII, from fixed phrases, hashtags and mentions               | no real content                                          |

## Options considered

1. **Publish a sample of the real data.** Not allowed, and it would put personal data on a public site.
2. **A generic fake-data library and `JSON.stringify`.** Quick, but the line layout would differ, the skip counts would land on the wrong lines, and the demo would no longer exercise the original algorithm.
3. **A layout-faithful, seeded generator** (chosen).
4. **Only let visitors load their own files.** Kept as an option (files stay in the browser and are never uploaded), but most visitors do not have the course files.

## Why

For a line scanner, the layout is the part that has to be right; the content only has to resolve to places. Seeding makes every file reproducible, so a benchmark or a bug report can name the exact input, and the parity fixtures can be regenerated from the command line.

## What happened

- On the same synthetic files the TypeScript port and the original Python give identical per-tweet records, per-rank counts and result files for 1, 3, 4 and 7 ranks. The boundary double count reproduces at 27 and 39 ranks, and the UTF-8 crash at 17 and 29 ranks on a non-ASCII variant (see [DR-001](DR-001-byte-range-chunking.md)).
- The file differs from the real one in ways that matter for timing:
  - Records are about 1.22 kB against about 2.06 kB, so there are about 1.7 times as many tweets per megabyte. Throughput in MB/s is not comparable between the lab and Spartan.
  - There are 24 tweets per author against about 76 in `bigTwitter.json`, so each rank's Task 1 and Task 3 tables are relatively bigger. That makes the gather and reduce step a larger share of a lab run, which pushes the lab's fitted serial fraction up.
  - The file sits in memory as a Blob, so the lab measures an in-memory, CPU-bound scan; Spartan's jobs also read from a shared file system.
- The default demo is ASCII only, so the UTF-8 crash cannot happen in it; the non-ASCII variant exists only in the test fixtures and in the command-line generator (`pnpm gen:synthetic --non-ascii`).

## What I'd change

- Calibrate the author pool to the published ratio (about 76 tweets per author) and the record length to about 2 kB, so the lab's mix of scanning and reducing is closer to Spartan's.
- Offer the non-ASCII variant in the lab, with a warning, so visitors can see the decode failure for themselves.
- Generate the place vocabulary from `sal.json` statistics instead of by hand, so its city mix can be checked rather than asserted.
