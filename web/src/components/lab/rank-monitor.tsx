"use client";

import {
  Activity,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { RankView, RunView } from "@/hooks/use-mpi-lab";
import { linearScale, niceStep } from "@/lib/chart";
import { BENCHMARKS, DATASET } from "@/lib/data/original";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import type { OutputCheck } from "@/lib/lab/runs";
import { cn } from "@/lib/utils";
import { now } from "@/workers/protocol";

/** Spartan 2023: all of bigTwitter.json on one Python core (1 node × 1 core job). */
const SPARTAN_MBPS = DATASET.bytes / BENCHMARKS.find((b) => b.cores === 1)!.seconds / 1e6;

function useTicker(active: boolean, t0: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setElapsed(now() - t0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, t0]);
  return elapsed;
}

/** "T1", "T2+T3" or "T1–T3" (a single rank hosts all three tasks). */
function taskList(r: RankView): string {
  const ids = r.tasks.map((t) => t.task);
  return ids.length === 3 ? "T1–T3" : ids.map((t) => `T${t}`).join("+");
}

function phaseLabel(r: RankView): string {
  switch (r.phase) {
    case "queued":
      return "queued";
    case "scanning":
      return "scanning";
    case "sent":
      return r.tasks.length ? "waiting" : "sent partials";
    case "reducing":
      return `reducing ${taskList(r)}`;
    case "done":
      return r.tasks.length ? `wrote ${taskList(r)}` : "done";
    case "failed":
      return "raised";
  }
}

export function RankMonitor({
  run,
  check,
  fileBytes,
}: {
  run: RunView | null;
  /** How this run's output compares with the clean baseline (null until it finishes). */
  check: OutputCheck | null;
  fileBytes: number | null;
}) {
  const live = run?.status === "running" || run?.status === "warming";
  const elapsed = useTicker(!!live, run?.t0 ?? 0);

  if (!run) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <Activity className="size-8 text-muted-foreground/60" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">
          {fileBytes === null
            ? "Generate or pick an input file, then run it. Each rank will appear here with its byte range, live progress and, afterwards, a timeline of scan and reduce phases."
            : "Ready. Choose a number of ranks and press Run."}
        </p>
      </div>
    );
  }

  const done = run.status === "done";
  const wall = run.wallMs ?? (live ? elapsed : (run.tEnd ?? run.t0) - run.t0);
  const tweets = run.ranks.reduce((s, r) => s + r.tweets, 0);
  const matched = run.ranks.reduce((s, r) => s + r.matched, 0);
  const bytes = fileBytes ?? 0;
  const perWorkerMBps = done
    ? Math.max(
        ...run.ranks.map(
          (r) => (r.end - r.start) / Math.max(1, (r.scanEnd ?? 0) - (r.scanStart ?? 0)) / 1000,
        ),
      )
    : null;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Wall clock"
          value={run.status === "warming" ? "starting" : formatMs(wall)}
          accent
        />
        <Stat label="Ranks" value={String(run.size)} />
        <Stat label="Tweets read" value={formatInt(tweets)} />
        <Stat
          label="In a capital"
          value={tweets ? `${Math.round((matched / tweets) * 100)}%` : "–"}
        />
      </dl>

      <StatusLine run={run} check={check} />

      {run.ranks.length > 0 && <Lanes run={run} live={!!live} elapsed={elapsed} />}

      {done && perWorkerMBps !== null && (
        <p className="text-xs text-muted-foreground">
          Fastest rank scanned at{" "}
          <span className="num font-mono text-foreground">{perWorkerMBps.toFixed(0)} MB/s</span> (
          {formatBytes(bytes)} in total). For scale, one Spartan core running the 2023 Python
          managed about{" "}
          <span className="num font-mono text-foreground">{SPARTAN_MBPS.toFixed(0)} MB/s</span>.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <dt className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn("num mt-0.5 font-heading text-lg font-semibold", accent && "text-primary")}>
        {value}
      </dd>
    </div>
  );
}

function StatusLine({ run, check }: { run: RunView; check: OutputCheck | null }) {
  if (run.status === "error") {
    return (
      <p
        className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {run.error}
          {run.error?.includes("UnicodeDecodeError") && (
            <span className="mt-1 block text-foreground">
              The 2023 code fails here too: it decodes every line it reads strictly, so this rank
              raises and the whole MPI job aborts. Any rank count whose chunks all start on a
              character boundary works.
            </span>
          )}
        </span>
      </p>
    );
  }
  if (run.status === "cancelled") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <CircleSlash className="size-4" aria-hidden /> Stopped. The rank workers were terminated.
      </p>
    );
  }
  if (run.status !== "done") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
        {run.status === "warming"
          ? "Starting rank workers…"
          : `Run #${run.id}: ${run.size} ranks scanning their byte ranges…`}
      </p>
    );
  }
  const extra = run.doubleCountRanks.length;
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" role="status">
        {check?.kind === "differs" ? (
          <CircleAlert className="size-4 text-destructive" aria-hidden />
        ) : (
          <CircleCheck className="size-4 text-success" aria-hidden />
        )}
        <span>Run #{run.id} finished.</span>
        {check === null ? null : check.kind === "baseline" ? (
          <span className="text-muted-foreground">
            No tweet was counted twice, so it is the baseline the other runs on this file are
            checked against.
          </span>
        ) : check.kind === "identical" ? (
          <span className="text-muted-foreground">
            All three result files are identical to run #{check.baselineId}&apos;s, the baseline.
          </span>
        ) : check.kind === "quirk" && check.baselineId !== null ? (
          <span className="text-muted-foreground">
            It differs from run #{check.baselineId} (the baseline) only by the{" "}
            {check.extra === 1 ? "tweet" : `${check.extra} tweets`} counted twice, explained below.
          </span>
        ) : check.kind === "quirk" ? (
          <span className="text-muted-foreground">
            It counted {check.extra === 1 ? "a tweet" : `${check.extra} tweets`} twice (below), so
            it cannot be the baseline. A 1-rank run never double-counts; run one to get a baseline.
          </span>
        ) : (
          <span className="text-destructive">
            Results differ from run #{check.baselineId}, the baseline, and no boundary quirk
            explains it.
          </span>
        )}
      </p>
      {extra > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-caution/40 bg-caution/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
          <span>
            {run.doubleCountRanks.map((r) => `Rank ${r}`).join(", ")}{" "}
            {extra === 1 ? "starts" : "start"} a few bytes into the indentation of an{" "}
            <code className="font-mono text-xs">&quot;_id&quot;</code> line, so the rank before it
            and the rank itself both count that tweet (
            {extra === 1 ? "one extra tweet" : `${extra} extra tweets`}). The original 2023 code
            does exactly the same; the port keeps the bug rather than hiding it.{" "}
            <Link href="/how-it-works#split" className="link">
              Why?
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}

function Lanes({ run, live, elapsed }: { run: RunView; live: boolean; elapsed: number }) {
  const done = run.status === "done";
  const span = Math.max(1, done ? (run.wallMs ?? 1) : elapsed);
  const x = linearScale([0, span], [0, 100]);
  const step = niceStep(span, 4);
  const ticks: number[] = [];
  for (let t = 0; t <= span + 1e-6; t += step) ticks.push(t);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-series-1" aria-hidden /> scan own byte
          range
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-series-2" aria-hidden /> reduce a task
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 border-t border-dashed border-muted-foreground"
            aria-hidden
          />{" "}
          wait / relay
        </span>
      </div>
      <ol className="space-y-1.5" aria-label="Ranks">
        {run.ranks.map((r) => {
          const chunk = r.end - r.start;
          const progress = chunk > 0 ? r.bytesRead / chunk : 1;
          const scanS = r.scanStart !== undefined ? r.scanStart - run.t0 : null;
          const scanE = r.scanEnd !== undefined ? r.scanEnd - run.t0 : null;
          return (
            <li
              key={r.rank}
              className="grid grid-cols-[3.25rem_1fr] items-center gap-x-3 sm:grid-cols-[3.25rem_1fr_10.5rem]"
            >
              <span className="font-mono text-xs">
                rank <span className="text-primary">{r.rank}</span>
              </span>
              <div
                className="relative h-5 overflow-hidden rounded-[5px] bg-muted/60"
                role="img"
                aria-label={
                  done
                    ? `Rank ${r.rank}: scanned ${formatBytes(chunk)} in ${formatMs((scanE ?? 0) - (scanS ?? 0))}${
                        r.tasks.length
                          ? `, then reduced task ${r.tasks.map((t) => t.task).join(" and ")}`
                          : ""
                      }`
                    : `Rank ${r.rank}: ${Math.round(progress * 100)}% of its byte range`
                }
              >
                {!done || scanS === null || scanE === null ? (
                  <div
                    className={cn(
                      "h-full rounded-r-[4px] bg-series-1",
                      live && "transition-[width] duration-100",
                    )}
                    style={{ width: `${Math.min(100, progress * 100)}%` }}
                  />
                ) : (
                  <>
                    <div
                      className="absolute top-1/2 h-0 border-t border-dashed border-muted-foreground/60"
                      style={{ left: `${x(scanE)}%`, right: 0 }}
                    />
                    <div
                      className="absolute inset-y-0 rounded-[4px] bg-series-1"
                      style={{
                        left: `${x(scanS)}%`,
                        width: `${Math.max(0.5, x(scanE) - x(scanS))}%`,
                      }}
                    />
                    {r.tasks.map((t) => {
                      if (t.start === undefined || t.end === undefined) return null;
                      const width = Math.max(1.2, x(t.end - run.t0) - x(t.start - run.t0));
                      // keep tiny reduce bars inside the lane instead of clipping them
                      const left = Math.min(x(t.start - run.t0), 100 - width);
                      return (
                        <div
                          key={t.task}
                          className="absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-[4px] border-l-2 border-card bg-series-2 font-mono text-[0.6rem] text-white"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`Task ${t.task}: ${formatMs(t.end - t.start)}`}
                        >
                          {/* the label only where the bar is wide enough to hold it */}
                          {width >= 5 && <span className="hidden px-0.5 sm:inline">T{t.task}</span>}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <span className="col-start-2 flex items-center justify-between gap-2 font-mono text-[0.68rem] whitespace-nowrap text-muted-foreground sm:col-start-3">
                <span className="num">{formatInt(r.tweets)} tw</span>
                <span
                  className={cn(
                    "truncate",
                    r.phase === "scanning" && "text-primary",
                    r.phase === "failed" && "text-destructive",
                  )}
                >
                  {phaseLabel(r)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {done && (
        <div
          className="mt-1 grid grid-cols-[3.25rem_1fr] gap-x-3 sm:grid-cols-[3.25rem_1fr_10.5rem]"
          aria-hidden
        >
          <span />
          <div className="relative h-4 font-mono text-[0.6rem] whitespace-nowrap text-muted-foreground">
            {ticks.map((t, i) => (
              <span
                key={t}
                className={cn(
                  "absolute",
                  i === 0 ? "" : x(t) > 92 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: `${x(t)}%` }}
              >
                {formatMs(t)}
              </span>
            ))}
          </div>
        </div>
      )}
      <ByteMap run={run} />
    </div>
  );
}

/** The file as one bar, cut at split_file_into_chunks offsets. */
function ByteMap({ run }: { run: RunView }) {
  const total = run.ranks.at(-1)?.end ?? 0;
  if (!total) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
        split_file_into_chunks · {formatBytes(total)}
      </p>
      <div className="flex h-3 gap-[2px]" aria-hidden>
        {run.ranks.map((r) => (
          <div
            key={r.rank}
            className="relative h-full overflow-hidden rounded-[3px] bg-muted"
            style={{ flexGrow: r.end - r.start }}
          >
            <div
              className="h-full bg-series-1/70"
              style={{
                width: `${Math.min(100, (r.bytesRead / Math.max(1, r.end - r.start)) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-muted-foreground">
        <span>byte 0</span>
        <span>byte {formatInt(total)}</span>
      </div>
    </div>
  );
}
