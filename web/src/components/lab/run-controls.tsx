"use client";

import { Cpu, Gauge, LoaderCircle, Play, Square } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BenchState } from "@/hooks/use-mpi-lab";
import { getTaskRanks } from "@/lib/cruncher/chunks";

export type CountsMode = "spaced" | "every";

const REPEAT_OPTIONS = [3, 5, 7, 10];
const WARMUP_OPTIONS = [0, 1, 2];

const toggleOn =
  "data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary";

export function RunControls({
  size,
  onSize,
  maxWorkers,
  cores,
  canRun,
  running,
  onRun,
  onCancel,
  repeats,
  onRepeats,
  warmup,
  onWarmup,
  countsMode,
  onCountsMode,
  benchSizes,
  onBenchmark,
  bench,
}: {
  size: number;
  onSize: (n: number) => void;
  maxWorkers: number;
  cores: number;
  canRun: boolean;
  /** A run or a benchmark is in progress. */
  running: boolean;
  onRun: () => void;
  onCancel: () => void;
  repeats: number;
  onRepeats: (r: number) => void;
  warmup: number;
  onWarmup: (w: number) => void;
  countsMode: CountsMode;
  onCountsMode: (m: CountsMode) => void;
  /** Worker counts the benchmark will measure. */
  benchSizes: number[];
  onBenchmark: () => void;
  /** The benchmark in progress or last run (any file). */
  bench: BenchState | null;
}) {
  const options = Array.from({ length: maxWorkers }, (_, i) => i + 1);
  const [t1, t2, t3] = getTaskRanks(size);
  const id = useId();
  const totalRuns = (repeats + warmup) * benchSizes.length;
  const benchRunning = bench?.status === "running";

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="ranks-title">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 font-mono text-xs text-primary">
          2
        </span>
        <h2 id="ranks-title" className="font-heading text-base font-semibold tracking-tight">
          MPI ranks
        </h2>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[0.7rem] text-muted-foreground">
          <Cpu className="size-3.5" aria-hidden />
          {cores > 0
            ? `${cores} logical cores`
            : cores < 0
              ? "detecting cores"
              : "cores not reported"}
        </span>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={1}
        value={String(size)}
        onValueChange={(v) => v && onSize(Number(v))}
        aria-label="Number of ranks"
        className="flex w-full flex-wrap"
        disabled={running}
      >
        {options.map((n) =>
          n === 2 ? (
            <Tooltip key={n}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded-lg">
                  <span className="sr-only">2 ranks: unsupported by the original</span>
                  <ToggleGroupItem
                    value="2"
                    disabled
                    className="w-9 font-mono text-xs line-through"
                    aria-hidden
                    tabIndex={-1}
                  >
                    2
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">
                The original cannot run on 2 ranks: get_task_ranks still hands Task 3 to rank 2, so
                the sends to it fail.
              </TooltipContent>
            </Tooltip>
          ) : (
            <ToggleGroupItem
              key={n}
              value={String(n)}
              className={`w-9 font-mono text-xs ${toggleOn}`}
              aria-label={`${n} rank${n === 1 ? "" : "s"}`}
            >
              {n}
            </ToggleGroupItem>
          ),
        )}
      </ToggleGroup>

      <p className="mt-3 text-xs text-muted-foreground">
        {size === 1 ? (
          <>One rank reads the whole file and runs all three tasks, like the 1 node × 1 core job.</>
        ) : (
          <>
            The file is cut into {size} byte ranges. Task 1 is reduced on rank {t1}, Task 2 on rank{" "}
            {t2}, Task 3 on rank {t3}.
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {running ? (
          <Button variant="destructive" onClick={onCancel} className="flex-1">
            <Square aria-hidden /> Stop
          </Button>
        ) : (
          <Button onClick={onRun} disabled={!canRun} className="flex-1">
            <Play aria-hidden /> Run once on {size} rank{size === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      <fieldset className="mt-5 space-y-3 border-t pt-4" disabled={running}>
        <legend className="sr-only">Benchmark settings</legend>
        <p className="flex items-center gap-2 font-heading text-sm font-semibold">
          <Gauge className="size-4 text-primary" aria-hidden /> Benchmark
        </p>
        <p className="text-xs text-muted-foreground">
          Measures every worker count {repeats} times after {warmup === 0 ? "no" : warmup} warm-up
          round{warmup === 1 ? "" : "s"}, each round in a shuffled order, and reports medians with
          95% bootstrap intervals.
        </p>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
          <span id={`${id}-reps`} className="text-xs font-medium">
            Repeats
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={String(repeats)}
            onValueChange={(v) => v && onRepeats(Number(v))}
            aria-labelledby={`${id}-reps`}
          >
            {REPEAT_OPTIONS.map((r) => (
              <ToggleGroupItem
                key={r}
                value={String(r)}
                className={`px-2.5 font-mono text-xs ${toggleOn}`}
                aria-label={`${r} timed rounds`}
              >
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span id={`${id}-warm`} className="text-xs font-medium">
            Warm-up
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={String(warmup)}
            onValueChange={(v) => v && onWarmup(Number(v))}
            aria-labelledby={`${id}-warm`}
          >
            {WARMUP_OPTIONS.map((w) => (
              <ToggleGroupItem
                key={w}
                value={String(w)}
                className={`px-2.5 font-mono text-xs ${toggleOn}`}
                aria-label={`${w} warm-up round${w === 1 ? "" : "s"}`}
              >
                {w}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span id={`${id}-counts`} className="text-xs font-medium">
            Counts
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={countsMode}
            onValueChange={(v) => v && onCountsMode(v as CountsMode)}
            aria-labelledby={`${id}-counts`}
          >
            <ToggleGroupItem value="spaced" className={`px-2.5 text-xs ${toggleOn}`}>
              Spaced
            </ToggleGroupItem>
            <ToggleGroupItem value="every" className={`px-2.5 text-xs ${toggleOn}`}>
              Every
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="font-mono text-[0.7rem] text-muted-foreground">
          n = {benchSizes.join(", ")} · ({warmup} + {repeats}) × {benchSizes.length} = {totalRuns}{" "}
          runs
        </p>
        {!running && (
          <Button variant="outline" onClick={onBenchmark} disabled={!canRun} className="w-full">
            <Gauge aria-hidden /> Run benchmark
          </Button>
        )}
      </fieldset>

      {benchRunning && bench && (
        <div className="mt-3 space-y-1.5" role="status" aria-live="polite">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="size-3 animate-spin" aria-hidden />
            {bench.current
              ? bench.current.warmup
                ? `Warm-up, ${bench.current.size} rank${bench.current.size === 1 ? "" : "s"}`
                : `Round ${bench.current.round + 1} of ${bench.plan.repeats}, ${bench.current.size} rank${bench.current.size === 1 ? "" : "s"}`
              : "Starting…"}
            <span className="ml-auto font-mono">
              {bench.done}/{bench.total}
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${(bench.done / Math.max(1, bench.total)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
