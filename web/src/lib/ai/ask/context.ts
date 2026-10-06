/**
 * The grounding context for "Ask the results": the three original result
 * tables, the dataset summary and both sets of Spartan benchmark jobs,
 * exactly as transcribed in lib/data/original.ts, rendered as plain text with
 * a stable id on every row so answers can cite them.
 *
 * Nothing is derived or added here (no speedups, no shares): any arithmetic
 * the model does must be shown in its answer, where it can be checked.
 */
import {
  BENCHMARKS,
  DATASET,
  DEV_BENCHMARKS,
  SUBJECT,
  TASK1,
  TASK1_ID_NOTE,
  TASK2,
  TASK3,
  parseTask3Text,
  type BenchmarkRun,
} from "../../data/original";
import { gccInfo } from "../../gcc";

export interface ContextRow {
  /** Citation id, e.g. "T2.2". */
  id: string;
  table: TableId;
  /** Cell values in column order. */
  cells: ReadonlyArray<string | number>;
}

export type TableId = "D" | "T1" | "T2" | "T3" | "B1" | "B2";

export interface ContextTable {
  id: TableId;
  title: string;
  notes: readonly string[];
  columns: readonly string[];
  rows: readonly ContextRow[];
}

function table(
  id: TableId,
  title: string,
  notes: readonly string[],
  columns: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
): ContextTable {
  return {
    id,
    title,
    notes,
    columns,
    rows: rows.map((cells, i) => ({ id: `${id}.${i + 1}`, table: id, cells })),
  };
}

function benchRows(runs: readonly BenchmarkRun[]) {
  return runs.map((r) => [
    r.jobId,
    r.label,
    r.nodes,
    r.cores,
    r.wallClock,
    r.seconds,
    r.cpuEfficiency,
  ]);
}

const BENCH_COLUMNS = [
  "slurm_job",
  "layout",
  "nodes",
  "cores",
  "wall_clock_hh_mm_ss",
  "wall_clock_seconds",
  "cpu_utilisation_pct",
] as const;

export function buildTables(): ContextTable[] {
  return [
    table(
      "D",
      "Dataset processed in the final run",
      [`${SUBJECT.code} ${SUBJECT.assignment}, ${SUBJECT.university}, ${SUBJECT.term}.`],
      ["field", "value"],
      [
        ["file", DATASET.file],
        ["size_bytes", DATASET.bytes],
        ["tweets", DATASET.tweets],
        ["distinct_authors", DATASET.authors],
        ["first_day", DATASET.firstDay],
        ["last_day", DATASET.lastDay],
        ["sal_json_entries", DATASET.salEntries],
      ],
    ),
    table(
      "T1",
      "Task 1: authors with the most tweets (top 10)",
      [TASK1_ID_NOTE, "Ties share a rank (rank method 'min')."],
      ["rank", "author_id", "tweets"],
      TASK1.map((r) => [r.rank, r.authorId, r.tweets]),
    ),
    table(
      "T2",
      "Task 2: tweets per Greater Capital City",
      [
        "Only the eight capital cities and Other Territories are counted; tweets matched to rural areas (Rest of a state) or to no place were excluded by the original program, so no rural counts exist.",
      ],
      ["gcc_code", "name", "tweets"],
      TASK2.map((r) => [r.gcc, gccInfo(r.gcc)?.name ?? r.gcc, r.tweets]),
    ),
    table(
      "T3",
      "Task 3: authors who tweeted from the most Greater Capital Cities (top 10)",
      [
        "result is the verbatim cell: number of cities (#total tweets in capital cities - #tweets per city code).",
        "City codes: gsyd Sydney, gmel Melbourne, gbri Brisbane, gade Adelaide, gper Perth, ghob Hobart, gdar Darwin, acte Canberra (ACT).",
      ],
      ["rank", "author_id", "cities", "capital_city_tweets", "result"],
      TASK3.map((r) => {
        const p = parseTask3Text(r.text);
        return [r.rank, r.authorId, p.gccCount, p.tweets, r.text];
      }),
    ),
    table(
      "B1",
      "Final benchmark jobs on Spartan (bigTwitter.json, one run per layout)",
      ["cpu_utilisation_pct is Spartan's own job statistic."],
      BENCH_COLUMNS,
      benchRows(BENCHMARKS),
    ),
    table(
      "B2",
      "Earlier revision benchmarked on 2 April 2023 (same file and layouts, one run per layout)",
      ["cpu_utilisation_pct is the mean per-core utilisation printed by my-job-stats."],
      BENCH_COLUMNS,
      benchRows(DEV_BENCHMARKS),
    ),
  ];
}

export function renderTable(t: ContextTable): string {
  const lines = [`## Table ${t.id}: ${t.title}`];
  for (const n of t.notes) lines.push(`Note: ${n}`);
  lines.push(["id", ...t.columns].join(" | "));
  for (const r of t.rows) lines.push([r.id, ...r.cells.map(String)].join(" | "));
  return lines.join("\n");
}

/** The context text, byte-for-byte what the model receives (and what is hashed). */
export function renderContext(tables: readonly ContextTable[] = buildTables()): string {
  return `${tables.map(renderTable).join("\n\n")}\n`;
}

export const CONTEXT_TABLES: readonly ContextTable[] = buildTables();
export const ASK_CONTEXT: string = renderContext(CONTEXT_TABLES);

export const ROW_INDEX: ReadonlyMap<string, ContextRow & { columns: readonly string[] }> = new Map(
  CONTEXT_TABLES.flatMap((t) => t.rows.map((r) => [r.id, { ...r, columns: t.columns }] as const)),
);

/** "T2.2 | 2gmel | Greater Melbourne | 2284909" */
export function rowText(id: string): string | null {
  const r = ROW_INDEX.get(id);
  return r ? [r.id, ...r.cells.map(String)].join(" | ") : null;
}
