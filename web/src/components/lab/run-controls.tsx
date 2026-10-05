"use client";

import { Cpu, LoaderCircle, Play, Repeat, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getTaskRanks } from "@/lib/cruncher/chunks";
import { sweepSizes } from "@/lib/lab/runs";

export function RunControls({
  size,
  onSize,
  maxWorkers,
  cores,
  canRun,
  running,
  sweeping,
  onRun,
  onSweep,
  onCancel,
}: {
  size: number;
  onSize: (n: number) => void;
  maxWorkers: number;
  cores: number;
  canRun: boolean;
  running: boolean;
  sweeping: boolean;
  onRun: () => void;
  onSweep: () => void;
  onCancel: () => void;
}) {
  const options = Array.from({ length: maxWorkers }, (_, i) => i + 1);
  const [t1, t2, t3] = getTaskRanks(size);
  const sweepList = sweepSizes(maxWorkers);

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
                <span
                  tabIndex={0}
                  className="rounded-lg"
                  aria-label="2 ranks: unsupported by the original"
                >
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
              className="w-9 font-mono text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
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
          <>
            <Button onClick={onRun} disabled={!canRun} className="flex-1">
              <Play aria-hidden /> Run on {size} rank{size === 1 ? "" : "s"}
            </Button>
            <Button
              variant="outline"
              onClick={onSweep}
              disabled={!canRun}
              title={`Runs ${sweepList.join(", ")} ranks in turn`}
            >
              <Repeat aria-hidden /> Sweep 1–{maxWorkers}
            </Button>
          </>
        )}
      </div>
      {sweeping && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <LoaderCircle className="size-3 animate-spin" aria-hidden /> Sweeping{" "}
          {sweepList.join(", ")} ranks…
        </p>
      )}
    </section>
  );
}
