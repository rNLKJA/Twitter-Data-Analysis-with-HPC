<div align="center">

# Spartan Tweet Cruncher

**COMP90024 Cluster and Cloud Computing, Assignment 1, revived.**
An MPI program that crunched 9.09 million geotagged tweets on the University of Melbourne's Spartan HPC,
brought back as an interactive site: the original results, the scaling story, and the same algorithm running
on your own CPU cores in the browser.

[![CI](https://github.com/rNLKJA/Twitter-Data-Analysis-with-HPC/actions/workflows/ci.yml/badge.svg)](https://github.com/rNLKJA/Twitter-Data-Analysis-with-HPC/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Original: Python + mpi4py](https://img.shields.io/badge/original-Python%20%2B%20mpi4py-3776AB?logo=python&logoColor=white)](./coursework)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Live demo:** https://comp90024-spartan-twitter.vercel.app (deployment pending)

</div>

## What the assignment asked

Each pair had to write a parallel program for Spartan that reads a very large Twitter dataset
(`bigTwitter.json`, 18.74 GB) together with a gazetteer of Australian suburbs (`sal.json`), and answers three
questions:

1. Which authors tweeted the most?
2. How many tweets were made in each Greater Capital City?
3. Which authors tweeted from the most different Greater Capital Cities?

The program had to run on 1 node × 1 core, 1 node × 8 cores and 2 nodes × 4 cores, and the report had to
explain the timings.

## What we built (2023)

A Python 3.7 + `mpi4py` program (in [`coursework/`](./coursework)) that never parses the file as JSON:

- **Split** the file into equal byte ranges, one per MPI rank (`split_file_into_chunks`).
- **Scan** each range line by line with three regular expressions (`_id`, `author_id`, `full_name`), skipping
  2, 18 and 20 lines after each hit to jump over the fields it does not need (`twitter_processorV1`).
- **Match** each place name to a Greater Capital City by normalising it and looking its word n-grams up in a
  dictionary built from `sal.json`.
- **Gather** three small partial tables onto ranks 0, 1 and 2, which reduce Task 1, 2 and 3 and write one CSV
  each.

### Results on `bigTwitter.json` (9,092,274 tweets, 119,439 authors, 2021-07-05 to 2022-12-31)

| Slurm job | Layout | Wall-clock | Speedup | CPU utilisation |
| --- | --- | ---: | ---: | ---: |
| 46094405 | 1 node × 1 core | 11:01 | 1.00× | 98.34% |
| 46094406 | 1 node × 8 cores | 1:41 | 6.54× | 87.13% |
| 46094407 | 2 nodes × 4 cores | 1:41 | 6.54× | 87.75% |

Fitting Amdahl's law to these runs gives a serial fraction of about 3.2%, a ceiling near 31×.

- **Task 1:** the most prolific account posted 68,477 tweets, 2.4 times the runner-up.
- **Task 2:** Melbourne (2,284,909) edged out Sydney (2,218,689); 74.7% of all tweets resolved to a capital city.
- **Task 3:** all ten top authors tweeted from all eight capital cities.

Every table is on the [Results](https://comp90024-spartan-twitter.vercel.app/results) page, transcribed from the
submission. The Task 1 author IDs are shown as the report printed them: they passed through a spreadsheet, which
kept only 15 significant digits, so their trailing digits are lost (the counts are exact).

## What the revival adds (2026)

| Route | What it does |
| --- | --- |
| `/` | Plain-language overview, key numbers, about the project |
| `/results` | Task 2 map of Australia + table, Task 1 top tweeters, Task 3 heatmap, and the three result CSVs in `main.py`'s format (Task 1 author IDs as published) |
| `/scaling` | The final and an earlier set of Spartan benchmark jobs, speedup, efficiency, Karp–Flatt serial fraction, and an Amdahl's law explorer fitted to the measured runs |
| `/lab` | **MPI in your browser.** Generates a seeded synthetic file with the exact line layout of `bigTwitter.json`, splits it with the original chunking, and processes it with one Web Worker per rank. Live per-rank progress, a scan/reduce timeline, the three answers, a check of every run's output against a clean baseline run (one that counted no tweet twice), and a speedup curve fitted to your machine. You can also load your own course-format files locally |
| `/how-it-works` | Interactive chunk explorer on the real file size, a line-by-line trace of the scanner, the place matcher step by step, and the gather/reduce design |

### Faithful port, verified against the original

The browser runs a TypeScript port of the original algorithm in [`web/src/lib/cruncher`](./web/src/lib/cruncher),
magic numbers and quirks included. The original Python in `coursework/` (analysis logic as submitted) is run
outside Spartan by
[`scripts/run_original.py`](./scripts/run_original.py) (mpi4py stubbed, ranks re-enacted in `gather_task_tdf`
order, 2023 dependency pins) to produce reference outputs. The Vitest suite then checks that the port gives:

- identical per-tweet records (id, author, normalised place, city) and per-rank tweet counts for 1, 3, 4 and 7 ranks;
- identical `task1.csv`, `task2.csv`, `task3.csv` and `task3_1.csv`;
- the same crash where the original crashes: when a chunk starts inside a multi-byte UTF-8 character, the
  original's strict `line.decode()` raises `UnicodeDecodeError` and so does the port, with the same message
  (17 and 29 ranks on a 400-tweet file with non-ASCII text);
- the same `sal.json` dictionary (keys, codes and insertion order) on a sample;
- the same resolution for every place in the demo vocabulary as against the full `sal.json`.

Locally, with the course files (not committed), the full 16,616-key dictionary and the course's
`tinyTwitter.json` (1, 3, 4 and 8 ranks) also match exactly, as does a 122 MB synthetic file at 1, 6, 8 and 9 ranks.

### A bug found while porting

If a chunk boundary lands inside the four spaces of indentation before `"_id"`, the next rank's partial first
line still matches the `_id` regex while the previous rank reads that line in full, so **both ranks count the
tweet**. It is about a 1 in 500 chance per boundary on `bigTwitter.json`. The original Python does it (verified:
400 tweets read as 401 at 27 and 39 ranks), so the port keeps it, a parity test pins it, and the lab explains it
when one of your runs hits it.

Two more ways the 2023 code can fail are kept as well: a rank whose chunk starts inside a multi-byte character
raises `UnicodeDecodeError` (the lab reports it as that rank's error), and a file in which no tweet resolves to a
capital city makes Task 3 stop with a polars `ComputeError` (the lab shows the empty answer and says so).

## Tech stack

| | 2023 original | 2026 revival |
| --- | --- | --- |
| Language | Python 3.7 | TypeScript (strict) |
| Parallelism | mpi4py on Open MPI, Slurm on Spartan | Web Workers as ranks; the page relays partial tables like MPI send/recv |
| Data | polars, pandas, NumPy | framework-free ports in `web/src/lib`, Vitest unit and parity tests |
| UI | CSV files and a report | Next.js 16 (App Router, static), React 19, Tailwind CSS v4, shadcn/ui, lucide, next-themes, hand-rolled SVG charts, d3-geo + Natural Earth for the map |
| Tooling | | pnpm, ESLint, Prettier, GitHub Actions, uv for the Python scripts |

## Repository structure

```
.
├── README.md
├── LICENSE
├── .github/workflows/ci.yml     lint, typecheck, test and build the web app
├── coursework/                  the original 2023 submission (see coursework/README.md)
│   ├── main.py
│   ├── scripts/                 twitter_processor.py, sal_processor.py, mpi.py, utils.py, ...
│   ├── slurm/                   the three benchmark jobs
│   └── _archive/                the README as submitted
├── scripts/                     Python (uv) scripts that run the ORIGINAL code to make web artefacts
│   ├── _original.py             loads coursework/scripts/* as they are, outside Spartan
│   ├── run_original.py          re-enacts main.py rank by rank, dumps results as JSON
│   └── build_gazetteer.py       builds web/public/data/gazetteer.json
└── web/                         the Next.js app (Vercel root)
    ├── public/data/gazetteer.json
    ├── scripts/                 write-synthetic.ts, run-pipeline.ts: TS counterparts for parity checks. They
    │                            live with the web package (not in root scripts/) because they import its port
    │                            and run with its tsx: `pnpm gen:synthetic`, `pnpm run:pipeline`
    └── src/
        ├── app/                 /, /results, /scaling, /lab, /how-it-works, not-found, icon, OG image
        ├── components/          ui/ (shadcn), layout/, charts/, results/, scaling/, lab/, how/, home/
        ├── hooks/               use-mpi-lab (worker orchestration), use-element-width
        ├── lib/                 cruncher/ (the port), synth/ (seeded generator), lab/, data/, geo/, ...
        └── workers/             rank.worker.ts (one MPI rank), synth.worker.ts (file generator)
```

## Local development

Requirements: Node 20.9+ and pnpm 10.

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Data artefacts and how they are made

No course data is committed or served. The site uses:

| Artefact | Made by | Notes |
| --- | --- | --- |
| `web/src/lib/data/original.ts` | transcribed | Final results and benchmark numbers from the submission; earlier benchmarks from the Slurm logs on the `Spartan-running-test` branch |
| `web/public/data/gazetteer.json` | `scripts/build_gazetteer.py` | The original `process_salV1` + `normalise_location` run on `sal.json`, restricted to the keys any demo place name can hit (117 keys, 18 kB) |
| `web/src/lib/__fixtures__/*.json` | `scripts/run_original.py` | Outputs of the original Python on synthetic files (plain, and with non-ASCII text), used by the parity tests |
| Synthetic tweet files | `web/src/lib/synth` | Seeded, made-up tweets with `bigTwitter.json`'s line layout, generated in the browser |

To regenerate them you need `sal.json` from the course (place it anywhere, for example `scripts/.cache/`, which is
git-ignored) and [uv](https://docs.astral.sh/uv/):

```bash
# gazetteer for the web app
uv run scripts/build_gazetteer.py --sal scripts/.cache/sal.json

# parity fixture: the same synthetic file through the original Python and the port
(cd web && pnpm gen:synthetic --seed 2023 --tweets 400 --out ../scripts/.cache/synthetic-2023-400.json)
uv run scripts/run_original.py --twitter scripts/.cache/synthetic-2023-400.json \
  --sal scripts/.cache/sal.json --ranks 1 3 4 7 --records \
  --out web/src/lib/__fixtures__/parity-synthetic-2023-400.json
uv run scripts/run_original.py --twitter scripts/.cache/synthetic-2023-400.json \
  --sal scripts/.cache/sal.json --ranks 27 39 \
  --out web/src/lib/__fixtures__/parity-boundary-2023-400.json

# the same tweets with non-ASCII text: 17 and 29 ranks cut inside a character and crash
(cd web && pnpm gen:synthetic --seed 2023 --tweets 400 --non-ascii --out ../scripts/.cache/utf8-2023-400.json)
uv run scripts/run_original.py --twitter scripts/.cache/utf8-2023-400.json \
  --sal scripts/.cache/sal.json --ranks 1 4 17 29 --record-errors \
  --out web/src/lib/__fixtures__/parity-utf8-2023-400.json

# compare the port directly on any course-format file
(cd web && pnpm run:pipeline --twitter ../scripts/.cache/tinyTwitter.json \
  --sal ../scripts/.cache/sal.json --ranks 1 3 4 8 --out ../scripts/.cache/tiny.port.json)
```

The Python scripts declare their dependencies inline (PEP 723: Python 3.11, polars 0.16.16, pandas 1.5.3), so
`uv run` needs no other set-up.

## Credits

- **Sunchuangyu (Rin) Huang** ([@rNLKJA](https://github.com/rNLKJA)): 2023 co-author; 2026 revival
- **Wei Zhao**: 2023 co-author

Map outline from [Natural Earth](https://www.naturalearthdata.com/) via
[world-atlas](https://github.com/topojson/world-atlas) (public domain).

## Academic integrity

The original 2023 submission is preserved in [`coursework/`](./coursework) for reference. The assignment brief,
the course datasets and the written report are not reproduced here or on the site; the task is paraphrased. If
you are taking COMP90024, please do your own work.

## Licence

[MIT](./LICENSE)
