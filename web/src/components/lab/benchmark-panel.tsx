"use client";

import { Download, Gauge, Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ScalingChart,
  ScalingLegend,
  type ChartKind,
  type MeasuredPoint,
} from "@/components/charts/scaling-chart";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { BenchState, DictState, LabFile } from "@/hooks/use-mpi-lab";
import { fitSerialFraction, serialFractionRoundingRange } from "@/lib/amdahl";
import { BENCHMARKS } from "@/lib/data/original";
import { downloadText } from "@/lib/download";
import { formatMs, formatPct } from "@/lib/format";
import { completeRounds, samplesCsv, summariseBenchmark } from "@/lib/lab/benchmark";
import type { Interval } from "@/lib/stats/interval";

const SPARTAN_T1 = BENCHMARKS.find((b) => b.cores === 1)!.seconds;
const SPARTAN_T8 = BENCHMARKS.find((b) => b.cores === 8 && b.nodes === 1)!.seconds;
const SPARTAN_F = fitSerialFraction(
  BENCHMARKS.filter((b) => b.cores > 1).map((b) => ({ n: b.cores, s: SPARTAN_T1 / b.seconds })),
);
const SPARTAN_ROUNDING = serialFractionRoundingRange(SPARTAN_T1, SPARTAN_T8, 8);

const x = (v: number) => `${v.toFixed(v < 10 ? 2 : 1)}×`;
const pct = (v: number) => (Number.isFinite(v) ? formatPct(v, 1) : "∞");
const ceil = (v: number) => (Number.isFinite(v) ? `${v.toFixed(v < 10 ? 1 : 0)}×` : "none");

/** Estimate on the first line, its interval underneath. */
function Cell({
  i,
  fmt,
  showCi = true,
}: {
  i: Interval;
  fmt: (v: number) => string;
  showCi?: boolean;
}) {
  return (
    <>
      <span className="block whitespace-nowrap">{fmt(i.estimate)}</span>
      {showCi && (
        <span className="block text-[0.68rem] whitespace-nowrap text-muted-foreground">
          {fmt(i.lo)} to {fmt(i.hi)}
        </span>
      )}
    </>
  );
}

function Ci({ i, fmt }: { i: Interval; fmt: (v: number) => string }) {
  return (
    <span className="num font-mono text-[0.7rem] text-muted-foreground">
      {fmt(i.lo)} to {fmt(i.hi)}
    </span>
  );
}

function Stat({
  label,
  i,
  fmt,
  tone,
  hint,
}: {
  label: string;
  i: Interval;
  fmt: (v: number) => string;
  tone?: "primary" | "signal";
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={`num font-heading text-lg font-semibold ${tone === "primary" ? "text-primary" : tone === "signal" ? "text-signal" : ""}`}
      >
        {fmt(i.estimate)}
      </dd>
      <dd className="text-[0.7rem] text-muted-foreground">
        95% CI <Ci i={i} fmt={fmt} />
        {hint ? <span className="block">{hint}</span> : null}
      </dd>
    </div>
  );
}

export function BenchmarkPanel({
  bench,
  runKey,
  file,
  dict,
  maxWorkers,
}: {
  bench: BenchState | null;
  /** Current file + dictionary; a benchmark of another file is not shown. */
  runKey: string | null;
  file: LabFile | null;
  dict: DictState;
  maxWorkers: number;
}) {
  const [kind, setKind] = useState<ChartKind>("speedup");
  const [hoverN, setHoverN] = useState<number | null>(null);
  const current = bench && bench.key === runKey ? bench : null;
  const sizes = current?.plan.sizes;
  const summary = useMemo(
    () => (current && sizes ? summariseBenchmark(current.samples, sizes) : null),
    [current, sizes],
  );

  const spartanNote = (
    <div className="flex gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p>
        <strong className="font-semibold text-foreground">
          Why Spartan&apos;s f has no interval.
        </strong>{" "}
        The 2023 benchmark is 3 configurations × 1 run, and both multi-core jobs used 8 cores, so
        its serial fraction ({formatPct(SPARTAN_F, 1)}) is the Karp–Flatt value at n = 8: a point
        estimate with no repeat to show run-to-run spread. Whole-second Slurm timing alone moves it
        between {formatPct(SPARTAN_ROUNDING[0], 2)} and {formatPct(SPARTAN_ROUNDING[1], 2)}. The
        benchmark here repeats every configuration so it can report an interval.{" "}
        <Link href="/methods#benchmark" className="link">
          Method
        </Link>
      </p>
    </div>
  );

  if (!current) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Gauge className="mx-auto size-7 text-muted-foreground/60" aria-hidden />
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Run the <span className="font-medium text-foreground">benchmark</span> to measure
            speedup on this machine with uncertainty: every worker count is run several times (7 by
            default) after a warm-up round, in a shuffled order each round, and the results are
            summarised as medians with 95% bootstrap intervals, an Amdahl fit with its own interval,
            and Gustafson&apos;s law for contrast.
          </p>
        </div>
        {spartanNote}
      </div>
    );
  }

  const rounds = sizes ? completeRounds(current.samples, sizes).length : 0;
  const plan = current.plan;

  if (!summary) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {current.status === "running"
            ? `Benchmark B${current.id} running: ${rounds} of ${plan.repeats} rounds complete. Intervals appear after two complete rounds.`
            : `Benchmark B${current.id} stopped after ${rounds} complete round${rounds === 1 ? "" : "s"}; at least two are needed for an interval.`}
        </p>
        {spartanNote}
      </div>
    );
  }

  const one = summary.configs.find((c) => c.n === 1)!;
  const best = summary.configs.reduce((a, b) => (b.speedup.estimate > a.speedup.estimate ? b : a));
  const f = summary.serialFraction;
  const maxN = Math.max(maxWorkers, ...summary.configs.map((c) => c.n));

  const measured: MeasuredPoint[] = summary.configs.map((c) => {
    const i = kind === "speedup" ? c.speedup : kind === "efficiency" ? c.efficiency : c.wallMs;
    const scale = kind === "time" ? 1 / 1000 : 1;
    return {
      n: c.n,
      value: i.estimate * scale,
      lo: i.lo * scale,
      hi: i.hi * scale,
      label: `median of ${c.runs}`,
      shape: c.n === 1 ? "diamond" : "circle",
    };
  });

  const exportBase = `benchmark-B${current.id}-${file?.name.replace(/\.json$/, "") ?? "file"}`;
  const exportJson = () =>
    downloadText(
      `${exportBase}.json`,
      `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          note: "Browser re-enactment of the COMP90024 MPI tweet cruncher. Wall times in ms. Intervals: percentile bootstrap over complete rounds.",
          protocol: {
            workerCounts: plan.sizes,
            timedRounds: plan.repeats,
            warmupRounds: plan.warmupRounds,
            orderSeed: plan.orderSeed,
            bootstrap: {
              resamples: summary.resamples,
              seed: summary.seed,
              level: summary.level,
              unit: "round",
            },
          },
          environment: {
            logicalCores: current.cores,
            userAgent: typeof navigator === "undefined" ? null : navigator.userAgent,
            startedAt: current.startedAt,
            finishedAt: current.finishedAt ?? null,
            status: current.status,
          },
          input: file
            ? {
                name: file.name,
                bytes: file.bytes,
                kind: file.kind,
                seed: file.seed ?? null,
                tweets: file.tweets ?? null,
              }
            : null,
          dictionary: { name: dict.name, hash: dict.hash },
          summary,
          samples: current.samples,
        },
        null,
        2,
      )}\n`,
      "application/json",
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          B{current.id}: {summary.rounds} complete round{summary.rounds === 1 ? "" : "s"} ×{" "}
          {plan.sizes.length} worker counts
          {current.status === "running"
            ? " so far (still running)"
            : current.status === "done"
              ? ""
              : ` (stopped early, ${current.status})`}
          .
        </p>
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              downloadText(`${exportBase}.csv`, samplesCsv(current.samples), "text/csv")
            }
          >
            <Download aria-hidden /> CSV
          </Button>
          <Button variant="outline" size="xs" onClick={exportJson}>
            <Download aria-hidden /> JSON
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4 lg:grid-cols-4">
        <Stat label="1-rank median" i={one.wallMs} fmt={formatMs} />
        <Stat
          label={`Best speedup (n = ${best.n})`}
          i={best.speedup}
          fmt={x}
          tone="primary"
          hint={`efficiency ${formatPct(best.efficiency.estimate, 0)}`}
        />
        {f ? <Stat label="Serial fraction f" i={f} fmt={pct} tone="signal" /> : <div />}
        {summary.ceiling ? <Stat label="Amdahl ceiling" i={summary.ceiling} fmt={ceil} /> : <div />}
      </dl>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {kind === "speedup"
              ? "Speedup over 1 rank"
              : kind === "efficiency"
                ? "Parallel efficiency (speedup / n)"
                : "Median wall time"}
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={kind}
            onValueChange={(v) => v && setKind(v as ChartKind)}
            aria-label="Chart"
          >
            {(
              [
                ["speedup", "Speedup"],
                ["time", "Wall time"],
                ["efficiency", "Efficiency"],
              ] as const
            ).map(([k, label]) => (
              <ToggleGroupItem
                key={k}
                value={k}
                className="px-2.5 text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ScalingChart
          kind={kind}
          t1={one.wallMs.estimate / 1000}
          f={f?.estimate ?? null}
          fBand={f ? [f.lo, f.hi] : null}
          showGustafson={kind !== "time"}
          maxN={maxN}
          measured={measured}
          focusN={hoverN}
          onHoverN={setHoverN}
          formatTime={(s) => formatMs(s * 1000)}
          title={`${kind === "speedup" ? "Speedup" : kind === "efficiency" ? "Efficiency" : "Median wall time"} of the browser benchmark against number of ranks, with 95% intervals, fitted Amdahl curve and band${kind === "time" ? "" : ", and Gustafson's law"}`}
        />
        <ScalingLegend
          showModel={!!f}
          showBand={!!f}
          showGustafson={!!f && kind !== "time"}
          showBars
          measured={[{ label: "This machine", shape: "circle" }]}
        />
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground sm:hidden">
          Swipe the table sideways for efficiency and the serial fraction.
        </p>
        <div
          className="overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label="Benchmark results by number of ranks, scrollable"
        >
          <table className="w-full min-w-[34rem] text-xs">
            <caption className="sr-only">
              Benchmark results per number of ranks: median wall time, speedup and efficiency, each
              with its 95% bootstrap interval underneath, the Karp–Flatt serial fraction, and the
              fastest and slowest run
            </caption>
            <thead className="bg-muted/30">
              <tr className="text-left font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground uppercase">
                <th scope="col" className="px-2.5 py-2 font-medium">
                  n
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  Runs
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  Median wall
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  Speedup
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  Efficiency
                </th>
                <th
                  scope="col"
                  className="px-2.5 py-2 text-right font-medium"
                  title="Karp–Flatt experimentally determined serial fraction"
                >
                  Karp–Flatt e
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  Range
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.configs.map((c) => (
                <tr key={c.n} className="border-t border-border/60">
                  <th scope="row" className="num px-2.5 py-1.5 text-left font-mono font-medium">
                    {c.n}
                  </th>
                  <td className="num px-2.5 py-1.5 text-right font-mono">{c.runs}</td>
                  <td className="num px-2.5 py-1.5 text-right font-mono">
                    <Cell i={c.wallMs} fmt={formatMs} />
                  </td>
                  <td className="num px-2.5 py-1.5 text-right font-mono">
                    <Cell i={c.speedup} fmt={x} showCi={c.n > 1} />
                  </td>
                  <td className="num px-2.5 py-1.5 text-right font-mono">
                    <Cell i={c.efficiency} fmt={(v) => formatPct(v, 0)} showCi={c.n > 1} />
                  </td>
                  <td className="num px-2.5 py-1.5 text-right font-mono">
                    {c.karpFlatt ? pct(c.karpFlatt.estimate) : "–"}
                  </td>
                  <td className="num px-2.5 py-1.5 text-right font-mono text-muted-foreground">
                    <span className="block">{formatMs(c.minMs)}</span>
                    <span className="block text-[0.68rem] whitespace-nowrap">
                      to {formatMs(c.maxMs)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <strong className="font-medium text-foreground">How to read this.</strong> Each point is
          the median of {summary.rounds} timed runs; bars and the shaded band are 95% percentile
          bootstrap intervals ({summary.resamples.toLocaleString("en-AU")} resamples of whole
          rounds, seed {summary.seed}), so runs made under the same conditions stay together.
          Amdahl&apos;s f is a least-squares fit to the median speedups. Gustafson&apos;s line uses
          the same f but assumes the file grows with the workers (weak scaling); the lab keeps the
          file fixed (strong scaling), so Amdahl is the model being tested and Gustafson is drawn
          for contrast. With few runs the interval of a median can only land on observed values, so
          treat it as a description of run-to-run spread on this machine, not a guarantee. Bars
          narrower than their marker are hidden behind it; the table lists every interval.
        </p>
        <p>
          Browsers report logical cores, which can include hyper-threads or slower efficiency cores,
          so the curve can flatten beyond the number of performance cores for reasons Amdahl&apos;s
          law does not model. The fitted f absorbs everything that does not shrink as workers are
          added on this machine (relaying tables, the reductions, slower cores), so it describes
          this program on this machine and file, not the program alone.
        </p>
        <p>
          Protocol: {plan.warmupRounds} warm-up round{plan.warmupRounds === 1 ? "" : "s"} discarded,
          then {plan.repeats} rounds, run order shuffled per round (seed {plan.orderSeed}).{" "}
          {current.cores > 0 ? `${current.cores} logical cores reported. ` : ""}
          {file?.kind === "synthetic"
            ? `Input: synthetic file, seed ${file.seed}, ${file.tweets?.toLocaleString("en-AU")} tweets.`
            : file
              ? `Input: ${file.name}.`
              : ""}
        </p>
      </div>
      {spartanNote}
    </div>
  );
}
