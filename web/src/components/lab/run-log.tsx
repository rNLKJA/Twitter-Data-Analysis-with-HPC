"use client";

import { CircleCheck, CircleDot, CircleX, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMs } from "@/lib/format";
import { checkOutput, type RunRecord } from "@/lib/lab/runs";

/**
 * Every finished run on the current file and dictionary, newest first, with
 * its output checked against the clean baseline. Timings here are single
 * runs; the benchmark panel is where they are summarised with intervals.
 */
export function RunLog({
  history,
  runKey,
  onClear,
}: {
  history: RunRecord[];
  /** Current file + dictionary; only its runs are listed. */
  runKey: string | null;
  onClear: () => void;
}) {
  const runs = runKey ? history.filter((h) => h.key === runKey) : [];

  if (runs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Finished runs on the current file and place dictionary are listed here, each checked against
        the first run that counted no tweet twice.
      </p>
    );
  }

  const checks = runs.map((r) => checkOutput(r, history));
  const identical = checks.filter((c) => c.kind === "identical" || c.kind === "baseline").length;
  const differs = checks.filter((c) => c.kind === "differs").length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {runs.length} run{runs.length === 1 ? "" : "s"}: {identical} match the baseline
        {differs > 0 ? `, ${differs} differ with no explanation` : ""}
        {runs.length - identical - differs > 0
          ? `, ${runs.length - identical - differs} double-counted a tweet at a chunk boundary`
          : ""}
        .
      </p>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
            Run log
          </p>
          <Button variant="ghost" size="xs" onClick={onClear}>
            <Trash2 aria-hidden /> Clear
          </Button>
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border" tabIndex={0} aria-label="Run log">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground uppercase">
                <th scope="col" className="px-2.5 py-1.5 font-medium">
                  Run
                </th>
                <th scope="col" className="px-2.5 py-1.5 font-medium">
                  Ranks
                </th>
                <th
                  scope="col"
                  className="px-2.5 py-1.5 font-medium"
                  title="Benchmark and round (W = warm-up), or a single run"
                >
                  Bench
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-medium">
                  Wall
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
                    <td className="px-2.5 py-1.5 font-mono text-muted-foreground">
                      {r.bench
                        ? r.bench.warmup
                          ? `B${r.bench.id}·W`
                          : `B${r.bench.id}·R${r.bench.round + 1}`
                        : "single"}
                    </td>
                    <td className="num px-2.5 py-1.5 text-right font-mono">{formatMs(r.wallMs)}</td>
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
