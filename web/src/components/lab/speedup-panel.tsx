"use client";

import { CircleCheck, CircleDot, CircleX, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { ScalingChart, ScalingLegend, type MeasuredPoint } from "@/components/charts/scaling-chart";
import { Button } from "@/components/ui/button";
import { amdahlLimit, fitSerialFraction } from "@/lib/amdahl";
import { BENCHMARKS } from "@/lib/data/original";
import { formatMs, formatPct } from "@/lib/format";
import { checkOutput, summariseSpeedup, type RunRecord } from "@/lib/lab/runs";

const SPARTAN_T1 = BENCHMARKS.find((b) => b.cores === 1)!.seconds;
const SPARTAN_F = fitSerialFraction(
  BENCHMARKS.filter((b) => b.cores > 1).map((b) => ({ n: b.cores, s: SPARTAN_T1 / b.seconds })),
);

export function SpeedupPanel({
  history,
  runKey,
  maxWorkers,
  onClear,
}: {
  history: RunRecord[];
  /** Current file + dictionary; only its runs are listed and fitted. */
  runKey: string | null;
  maxWorkers: number;
  onClear: () => void;
}) {
  const [hoverN, setHoverN] = useState<number | null>(null);
  const runs = runKey ? history.filter((h) => h.key === runKey) : [];
  const summary = runKey ? summariseSpeedup(history, runKey) : null;

  if (!summary || runs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Runs on the current file and place dictionary are collected here. Use{" "}
        <span className="font-medium text-foreground">Sweep</span>, or run 1 rank and then a few
        larger counts, to fit Amdahl&apos;s law to your own machine.
      </p>
    );
  }

  const measured: MeasuredPoint[] = summary.points
    .filter((p) => p.speedup !== null)
    .map((p) => ({
      n: p.n,
      value: p.speedup!,
      label: `best of ${p.n}-rank runs`,
      shape: p.n === 1 ? "diamond" : "circle",
    }));

  return (
    <div className="space-y-4">
      {summary.t1Ms === null ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add a 1-rank run: speedup is measured against its time.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
                1-rank time
              </dt>
              <dd className="num font-heading text-lg font-semibold">{formatMs(summary.t1Ms)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
                Best speedup
              </dt>
              <dd className="num font-heading text-lg font-semibold text-primary">
                {Math.max(...summary.points.map((p) => p.speedup ?? 0)).toFixed(2)}×
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
                Serial f
              </dt>
              <dd className="num font-heading text-lg font-semibold text-signal">
                {summary.serialFraction === null ? "–" : formatPct(summary.serialFraction, 1)}
              </dd>
            </div>
          </dl>
          <ScalingChart
            kind="speedup"
            t1={summary.t1Ms / 1000}
            f={summary.serialFraction}
            maxN={Math.max(maxWorkers, ...summary.points.map((p) => p.n))}
            measured={measured}
            focusN={hoverN}
            onHoverN={setHoverN}
            formatTime={(s) => formatMs(s * 1000)}
            title="Speedup of your browser runs against number of ranks, with fitted Amdahl curve"
          />
          <ScalingLegend
            showModel={summary.serialFraction !== null}
            measured={[{ label: "Your machine (best run per rank count)", shape: "circle" }]}
          />
          {summary.serialFraction !== null && (
            <p className="text-xs text-muted-foreground">
              Fitted serial fraction {formatPct(summary.serialFraction, 1)}: on this file, no number
              of workers would beat {amdahlLimit(summary.serialFraction).toFixed(0)}×.
              Spartan&apos;s fit was {formatPct(SPARTAN_F, 1)}. Page-to-worker messaging, the
              reductions and your browser&apos;s scheduler play the part of MPI start-up here.
            </p>
          )}
        </>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
            Run log
          </p>
          <Button variant="ghost" size="xs" onClick={onClear}>
            <Trash2 aria-hidden /> Clear
          </Button>
        </div>
        <div className="max-h-56 overflow-auto rounded-lg border" tabIndex={0} aria-label="Run log">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground uppercase">
                <th scope="col" className="px-2.5 py-1.5 font-medium">
                  Run
                </th>
                <th scope="col" className="px-2.5 py-1.5 font-medium">
                  Ranks
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
                  Wall
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
                  Speedup
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
                  Output
                </th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => {
                const check = checkOutput(r, history);
                return (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="num px-2.5 py-1.5 font-mono">#{r.id}</td>
                    <td className="num px-2.5 py-1.5 font-mono">{r.size}</td>
                    <td className="num px-2.5 py-1.5 text-right font-mono">{formatMs(r.wallMs)}</td>
                    <td className="num px-2.5 py-1.5 text-right font-mono">
                      {summary.t1Ms === null ? "–" : `${(summary.t1Ms / r.wallMs).toFixed(2)}×`}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {check.kind === "baseline" ? (
                        <span
                          className="inline-flex items-center gap-1 text-muted-foreground"
                          title="The first run with no double-counted tweet; the others are checked against it"
                        >
                          <CircleDot className="size-3.5" aria-hidden /> baseline
                        </span>
                      ) : check.kind === "identical" ? (
                        <span
                          className="inline-flex items-center gap-1 text-success"
                          title={`Same three result files as run #${check.baselineId}`}
                        >
                          <CircleCheck className="size-3.5" aria-hidden /> identical
                        </span>
                      ) : check.kind === "quirk" ? (
                        <span
                          className="inline-flex items-center gap-1 text-caution"
                          title="A chunk boundary inside an _id line's indentation made two ranks count the same tweet, exactly as the original does"
                        >
                          <TriangleAlert className="size-3.5" aria-hidden /> +{check.extra} tweet
                          {check.extra === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-destructive"
                          title={`Differs from run #${check.baselineId} with no boundary quirk to explain it`}
                        >
                          <CircleX className="size-3.5" aria-hidden /> differs
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
