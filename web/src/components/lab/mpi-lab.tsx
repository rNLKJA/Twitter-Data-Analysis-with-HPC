"use client";

import { useState } from "react";

import { BenchmarkPanel } from "@/components/lab/benchmark-panel";
import { FileCard, SourcePanel } from "@/components/lab/source-panel";
import { LabResults } from "@/components/lab/lab-results";
import { RankMonitor } from "@/components/lab/rank-monitor";
import { RunControls, type CountsMode } from "@/components/lab/run-controls";
import { RunLog } from "@/components/lab/run-log";
import { useMpiLab } from "@/hooks/use-mpi-lab";
import { BENCHMARK_DEFAULTS, spacedSizes } from "@/lib/lab/benchmark";
import { checkOutput, sweepSizes } from "@/lib/lab/runs";

export function MpiLab() {
  const lab = useMpiLab();
  const [chosen, setChosen] = useState<number | null>(null);
  const [repeats, setRepeats] = useState<number>(BENCHMARK_DEFAULTS.repeats);
  const [warmup, setWarmup] = useState<number>(BENCHMARK_DEFAULTS.warmupRounds);
  const [countsMode, setCountsMode] = useState<CountsMode>("spaced");
  const size = Math.min(chosen ?? Math.min(8, lab.maxWorkers), lab.maxWorkers);
  const running = lab.run?.status === "running" || lab.run?.status === "warming";
  const busy = running || lab.sweeping;
  const ready = lab.source.status === "ready" && lab.dict.status === "ready";
  const file = lab.source.status === "ready" ? lab.source.file : null;
  const fileBytes = file?.bytes ?? null;
  // Runs belong to one file + dictionary; switching either starts a fresh comparison.
  const currentRun = lab.run && lab.run.key === lab.key ? lab.run : null;
  const record = currentRun ? lab.history.find((h) => h.id === currentRun.id) : undefined;
  const check = record ? checkOutput(record, lab.history) : null;
  const benchSizes =
    countsMode === "spaced" ? spacedSizes(lab.maxWorkers) : sweepSizes(lab.maxWorkers);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-5 lg:sticky lg:top-20">
        <SourcePanel
          source={lab.source}
          dict={lab.dict}
          busy={busy}
          onGenerate={lab.generate}
          onCancelGenerate={lab.cancelGenerate}
          onUpload={lab.loadUpload}
          onSalFile={lab.loadSalFile}
        />
        <FileCard source={lab.source} />
        <RunControls
          size={size}
          onSize={setChosen}
          maxWorkers={lab.maxWorkers}
          cores={lab.cores}
          canRun={ready && !busy}
          running={busy}
          onRun={() => void lab.startRun(size)}
          onCancel={lab.cancel}
          repeats={repeats}
          onRepeats={setRepeats}
          warmup={warmup}
          onWarmup={setWarmup}
          countsMode={countsMode}
          onCountsMode={setCountsMode}
          benchSizes={benchSizes}
          onBenchmark={() =>
            void lab.runBenchmark({
              sizes: benchSizes,
              repeats,
              warmupRounds: warmup,
              orderSeed: BENCHMARK_DEFAULTS.orderSeed,
            })
          }
          bench={lab.bench}
        />
      </div>

      <div className="min-w-0 space-y-5">
        <section className="panel p-4 sm:p-5" aria-labelledby="monitor-title">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 font-mono text-xs text-primary">
              3
            </span>
            <h2 id="monitor-title" className="font-heading text-base font-semibold tracking-tight">
              Rank monitor
            </h2>
            {currentRun && (
              <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
                job #{currentRun.id}
                {currentRun.bench
                  ? currentRun.bench.warmup
                    ? ` · B${currentRun.bench.id} warm-up`
                    : ` · B${currentRun.bench.id} round ${currentRun.bench.round + 1}`
                  : ""}
              </span>
            )}
          </div>
          <RankMonitor run={currentRun} check={check} fileBytes={fileBytes} />
        </section>

        <section className="panel p-4 sm:p-5" aria-labelledby="bench-title">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 font-mono text-xs text-primary">
              4
            </span>
            <h2 id="bench-title" className="font-heading text-base font-semibold tracking-tight">
              Scaling on this machine
            </h2>
          </div>
          <BenchmarkPanel
            bench={lab.bench}
            runKey={lab.key}
            file={file}
            dict={lab.dict}
            maxWorkers={lab.maxWorkers}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="panel p-4 sm:p-5" aria-labelledby="answers-title">
            <h2
              id="answers-title"
              className="mb-3 font-heading text-base font-semibold tracking-tight"
            >
              Answers from the task ranks
            </h2>
            <LabResults results={currentRun?.results} size={currentRun?.size ?? size} />
          </section>
          <section className="panel p-4 sm:p-5" aria-labelledby="log-title">
            <h2 id="log-title" className="mb-3 font-heading text-base font-semibold tracking-tight">
              Runs and output checks
            </h2>
            <RunLog history={lab.history} runKey={lab.key} onClear={lab.clearHistory} />
          </section>
        </div>
      </div>
    </div>
  );
}
