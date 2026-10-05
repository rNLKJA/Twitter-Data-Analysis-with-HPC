"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Slider } from "@/components/ui/slider";
import { getTaskRanks, isSupportedRankCount, splitFileIntoChunks } from "@/lib/cruncher/chunks";
import { DATASET } from "@/lib/data/original";
import { formatBytes, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** split_file_into_chunks on the real bigTwitter.json byte size, for any rank count. */
export function ChunkExplorer() {
  const [size, setSize] = useState(8);
  const { start, end } = splitFileIntoChunks(DATASET.bytes, size);
  const supported = isSupportedRankCount(size);
  const taskRanks = getTaskRanks(size);

  return (
    <div className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <label htmlFor="chunk-ranks" className="text-sm font-medium">
          MPI ranks (mpiexec -n)
        </label>
        <span className="num font-mono text-2xl font-semibold text-primary">{size}</span>
      </div>
      <Slider
        id="chunk-ranks"
        className="mt-3"
        min={1}
        max={16}
        step={1}
        value={[size]}
        onValueChange={([v]) => setSize(v)}
        aria-label="Number of MPI ranks"
      />

      <div className="mt-6 flex h-10 gap-[2px]" aria-hidden>
        {start.map((s, r) => (
          <div
            key={r}
            className={cn(
              "relative flex items-center justify-center overflow-hidden rounded-[4px] font-mono text-[0.65rem]",
              r % 2 ? "bg-series-1/55" : "bg-series-1/80",
              !supported && r >= 2 && "opacity-40",
            )}
            style={{ flexGrow: end[r] - s }}
          >
            <span className="text-[var(--on-series-1)]">{size <= 12 ? r : ""}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-muted-foreground">
        <span>0</span>
        <span>{formatBytes(DATASET.bytes)}</span>
      </div>

      {!supported && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg border border-signal/40 bg-signal/8 p-3 text-sm"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
          <span>
            With 2 ranks the original fails:{" "}
            <code className="font-mono text-xs">get_task_ranks</code> still makes rank 2 the Task 3
            host, so both ranks <code className="font-mono text-xs">comm.send</code> to a rank that
            does not exist and MPI aborts with an invalid-rank error. The assignment only ever
            needed 1 and 8 ranks.
          </span>
        </p>
      )}

      <div
        className="mt-5 max-h-72 overflow-auto rounded-lg border"
        tabIndex={0}
        aria-label="Byte ranges per rank"
      >
        <table className="w-full min-w-[30rem] text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left font-mono text-[0.62rem] tracking-[0.1em] text-muted-foreground uppercase">
              <th scope="col" className="px-3 py-2 font-medium">
                Rank
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                chunk_start
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                chunk_end
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Size
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Task host
              </th>
            </tr>
          </thead>
          <tbody>
            {start.map((s, r) => {
              const hosts = [1, 2, 3].filter((_, i) => taskRanks[i] === r);
              return (
                <tr key={r} className="border-t border-border/60">
                  <td className="num px-3 py-1.5 font-mono">{r}</td>
                  <td className="num px-3 py-1.5 text-right font-mono">{formatInt(s)}</td>
                  <td className="num px-3 py-1.5 text-right font-mono">{formatInt(end[r])}</td>
                  <td className="num px-3 py-1.5 text-right font-mono">
                    {formatBytes(end[r] - s)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {hosts.length ? hosts.map((t) => `task ${t}`).join(", ") : "–"}
                  </td>
                </tr>
              );
            })}
            {!supported && (
              <tr className="border-t border-border/60 text-signal">
                <td className="num px-3 py-1.5 font-mono">2</td>
                <td colSpan={3} className="px-3 py-1.5 text-right font-mono">
                  does not exist
                </td>
                <td className="px-3 py-1.5 font-mono">task 3 (!)</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        chunk_size = ceil(file_size / size); the last range absorbs the remainder. Offsets are for
        the real {formatInt(DATASET.bytes)}-byte bigTwitter.json.
      </p>
    </div>
  );
}
