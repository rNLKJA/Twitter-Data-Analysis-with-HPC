"use client";

import { useState } from "react";

import { FileCard, SourcePanel } from "@/components/lab/source-panel";
import { LabResults } from "@/components/lab/lab-results";
import { RankMonitor } from "@/components/lab/rank-monitor";
import { RunControls } from "@/components/lab/run-controls";
import { SpeedupPanel } from "@/components/lab/speedup-panel";
import { useMpiLab } from "@/hooks/use-mpi-lab";
import { sweepSizes } from "@/lib/lab/runs";

export function MpiLab() {
  const lab = useMpiLab();
  const [chosen, setChosen] = useState<number | null>(null);
  const size = Math.min(chosen ?? Math.min(8, lab.maxWorkers), lab.maxWorkers);
  const running = lab.run?.status === "running" || lab.run?.status === "warming";
  const busy = running || lab.sweeping;
  const ready = lab.source.status === "ready" && lab.dict.status === "ready";
  const fileId = lab.source.status === "ready" ? lab.source.file.id : null;
  const fileBytes = lab.source.status === "ready" ? lab.source.file.bytes : null;
  const currentRun = lab.run && lab.run.fileId === fileId ? lab.run : null;

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
          sweeping={lab.sweeping}
          onRun={() => void lab.startRun(size)}
          onSweep={() => void lab.sweep(sweepSizes(lab.maxWorkers))}
          onCancel={lab.cancel}
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
              </span>
            )}
          </div>
          <RankMonitor run={currentRun} fileBytes={fileBytes} />
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
          <section className="panel p-4 sm:p-5" aria-labelledby="speedup-title">
            <h2
              id="speedup-title"
              className="mb-3 font-heading text-base font-semibold tracking-tight"
            >
              Speedup on this machine
            </h2>
            <SpeedupPanel
              history={lab.history}
              fileId={fileId}
              maxWorkers={lab.maxWorkers}
              onClear={lab.clearHistory}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
