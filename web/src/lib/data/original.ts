import { gccByShort } from "../gcc";
import { parseClock } from "../format";

/**
 * Results of the final 2023 run on Spartan, transcribed from the team's
 * submission (README / report). Nothing here is recomputed — bigTwitter.json
 * was course data that only ever lived on Spartan.
 */

export const DATASET = {
  file: "bigTwitter.json",
  /** Byte size seen by split_file_into_chunks in the team's notebook. */
  bytes: 18_735_307_060,
  tweets: 9_092_274,
  authors: 119_439,
  firstDay: "2021-07-05",
  lastDay: "2022-12-31",
  salEntries: 15_340,
} as const;

export interface PublishedTask1Row {
  rank: number;
  /** As printed in the report; see TASK1_ID_NOTE. */
  authorId: string;
  tweets: number;
}

export const TASK1: readonly PublishedTask1Row[] = [
  { rank: 1, authorId: "1498063511204760000", tweets: 68_477 },
  { rank: 2, authorId: "1089023364973210000", tweets: 28_128 },
  { rank: 3, authorId: "826332877457481000", tweets: 27_718 },
  { rank: 4, authorId: "1250331934242120000", tweets: 25_350 },
  { rank: 5, authorId: "1423662808311280000", tweets: 21_034 },
  { rank: 6, authorId: "1183144981252280000", tweets: 20_765 },
  { rank: 7, authorId: "1270672820792500000", tweets: 20_503 },
  { rank: 8, authorId: "820431428835885000", tweets: 20_063 },
  { rank: 9, authorId: "778785859030003000", tweets: 19_403 },
  { rank: 10, authorId: "1104295492433760000", tweets: 18_781 },
];

export const TASK1_ID_NOTE =
  "Task 1 author IDs are shown exactly as published. The report table was pasted via a spreadsheet, " +
  "which keeps only 15 significant digits, so the trailing digits of these 18–19 digit IDs read as zeros. " +
  "The counts are unaffected.";

export interface PublishedTask2Row {
  gcc: string;
  tweets: number;
}

export const TASK2: readonly PublishedTask2Row[] = [
  { gcc: "1gsyd", tweets: 2_218_689 },
  { gcc: "2gmel", tweets: 2_284_909 },
  { gcc: "3gbri", tweets: 878_614 },
  { gcc: "4gade", tweets: 465_081 },
  { gcc: "5gper", tweets: 590_045 },
  { gcc: "6ghob", tweets: 91_112 },
  { gcc: "7gdar", tweets: 46_772 },
  { gcc: "8acte", tweets: 214_347 },
  { gcc: "9oter", tweets: 203 },
];

export const TASK2_TOTAL = TASK2.reduce((s, r) => s + r.tweets, 0);

export interface PublishedTask3Row {
  rank: number;
  authorId: string;
  /** Verbatim cell from task3.csv. */
  text: string;
}

export const TASK3: readonly PublishedTask3Row[] = [
  {
    rank: 1,
    authorId: "1429984556451389440",
    text: "8 (#1920 tweets - #1879gmel, #13acte, #11gsyd, #7gper, #6gbri, #2gade, #1gdar, #1ghob)",
  },
  {
    rank: 2,
    authorId: "702290904460169216",
    text: "8 (#1231 tweets - #336gsyd, #255gmel, #235gbri, #156gper, #127gade, #56acte, #45ghob, #21gdar)",
  },
  {
    rank: 3,
    authorId: "17285408",
    text: "8 (#1209 tweets - #1061gsyd, #60gmel, #40gbri, #23acte, #11ghob, #7gper, #4gdar, #3gade)",
  },
  {
    rank: 4,
    authorId: "87188071",
    text: "8 (#407 tweets - #116gsyd, #86gmel, #68gbri, #52gper, #37acte, #28gade, #15ghob, #5gdar)",
  },
  {
    rank: 5,
    authorId: "774694926135222272",
    text: "8 (#272 tweets - #38gmel, #37gbri, #37gsyd, #36ghob, #34acte, #34gper, #28gdar, #28gade)",
  },
  {
    rank: 6,
    authorId: "1361519083",
    text: "8 (#266 tweets - #193gdar, #36gmel, #18gsyd, #9gade, #6acte, #2ghob, #1gbri, #1gper)",
  },
  {
    rank: 7,
    authorId: "502381727",
    text: "8 (#250 tweets - #214gmel, #10acte, #8gbri, #8ghob, #4gade, #3gper, #2gsyd, #1gdar)",
  },
  {
    rank: 8,
    authorId: "921197448885886977",
    text: "8 (#207 tweets - #56gmel, #49gsyd, #37gbri, #28gper, #24gade, #8acte, #4ghob, #1gdar)",
  },
  {
    rank: 9,
    authorId: "601712763",
    text: "8 (#146 tweets - #44gsyd, #39gmel, #19gade, #14gper, #11gbri, #10acte, #8ghob, #1gdar)",
  },
  {
    rank: 10,
    authorId: "2647302752",
    text: "8 (#80 tweets - #32gbri, #16gmel, #13gsyd, #5ghob, #4gper, #4acte, #3gade, #3gdar)",
  },
];

export interface ParsedTask3 {
  gccCount: number;
  tweets: number;
  breakdown: Array<{ gcc: string; tweets: number }>;
}

/** Parse `8 (#1920 tweets - #1879gmel, #13acte, …)` back into numbers. */
export function parseTask3Text(text: string): ParsedTask3 {
  const m = /^(\d+) \(#(\d+) tweets - (.*)\)$/.exec(text.trim());
  if (!m) throw new Error(`Unrecognised Task 3 cell: ${text}`);
  const breakdown = m[3].split(",").map((seg) => {
    const p = /#(\d+)([a-z]{4})/.exec(seg.trim());
    if (!p) throw new Error(`Unrecognised Task 3 segment: ${seg}`);
    const info = gccByShort(p[2]);
    return { gcc: info?.code ?? p[2], tweets: Number(p[1]) };
  });
  return { gccCount: Number(m[1]), tweets: Number(m[2]), breakdown };
}

export interface BenchmarkRun {
  jobId: string;
  label: string;
  nodes: number;
  cores: number;
  coresPerNode: number;
  wallClock: string;
  seconds: number;
  /** CPU efficiency (%) reported by Spartan's job statistics. */
  cpuEfficiency: number;
  slurmScript: string;
}

function run(r: Omit<BenchmarkRun, "seconds">): BenchmarkRun {
  return { ...r, seconds: parseClock(r.wallClock) };
}

/** Final benchmark jobs (bigTwitter.json), as reported in the submission. */
export const BENCHMARKS: readonly BenchmarkRun[] = [
  run({
    jobId: "46094405",
    label: "1 node × 1 core",
    nodes: 1,
    cores: 1,
    coresPerNode: 1,
    wallClock: "00:11:01",
    cpuEfficiency: 98.34,
    slurmScript: "1node1core.bigTwitter.slurm",
  }),
  run({
    jobId: "46094406",
    label: "1 node × 8 cores",
    nodes: 1,
    cores: 8,
    coresPerNode: 8,
    wallClock: "00:01:41",
    cpuEfficiency: 87.13,
    slurmScript: "1node8core.bigTwitter.slurm",
  }),
  run({
    jobId: "46094407",
    label: "2 nodes × 4 cores",
    nodes: 2,
    cores: 8,
    coresPerNode: 4,
    wallClock: "00:01:41",
    cpuEfficiency: 87.75,
    slurmScript: "2node8core.bigTwitter.slurm",
  }),
];

/**
 * An earlier, working revision benchmarked on 2 April 2023 (Slurm logs kept on
 * the repo's Spartan-running-test branch). CPU figure = mean per-core
 * utilisation printed by `my-job-stats`.
 */
export const DEV_BENCHMARKS: readonly BenchmarkRun[] = [
  run({
    jobId: "45983020",
    label: "1 node × 1 core",
    nodes: 1,
    cores: 1,
    coresPerNode: 1,
    wallClock: "00:23:03",
    cpuEfficiency: 98.4,
    slurmScript: "1node1core.bigTwitter.slurm",
  }),
  run({
    jobId: "45983021",
    label: "1 node × 8 cores",
    nodes: 1,
    cores: 8,
    coresPerNode: 8,
    wallClock: "00:03:14",
    cpuEfficiency: 88.2,
    slurmScript: "1node8core.bigTwitter.slurm",
  }),
  run({
    jobId: "45983022",
    label: "2 nodes × 4 cores",
    nodes: 2,
    cores: 8,
    coresPerNode: 4,
    wallClock: "00:03:13",
    cpuEfficiency: 86.5,
    slurmScript: "2node8core.bigTwitter.slurm",
  }),
];

export const SUBJECT = {
  code: "COMP90024",
  name: "Cluster and Cloud Computing",
  university: "The University of Melbourne",
  term: "2023 Semester 1",
  assignment: "Assignment 1: Social Media Analytics on Spartan",
  team: [
    { name: "Sunchuangyu (Rin) Huang", github: "rNLKJA" },
    { name: "Wei Zhao", github: null },
  ],
  repo: "https://github.com/rNLKJA/Twitter-Data-Analysis-with-HPC",
} as const;
