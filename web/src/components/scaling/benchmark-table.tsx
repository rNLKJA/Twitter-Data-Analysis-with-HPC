import { karpFlatt } from "@/lib/amdahl";
import type { BenchmarkRun } from "@/lib/data/original";
import { formatPct } from "@/lib/format";

/** Spartan benchmark jobs with derived speedup, efficiency and Karp–Flatt serial fraction. */
export function BenchmarkTable({
  runs,
  caption,
}: {
  runs: readonly BenchmarkRun[];
  caption: string;
}) {
  const t1 = runs.find((r) => r.cores === 1)!.seconds;
  const maxSeconds = Math.max(...runs.map((r) => r.seconds));
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[620px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left font-mono text-[0.66rem] tracking-[0.1em] text-muted-foreground uppercase">
            <th scope="col" className="pb-2 font-medium">
              Slurm job
            </th>
            <th scope="col" className="pb-2 font-medium">
              Layout
            </th>
            <th scope="col" className="pb-2 font-medium">
              Wall-clock
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Speedup
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Efficiency
            </th>
            <th
              scope="col"
              className="pb-2 text-right font-medium"
              title="Karp–Flatt experimentally determined serial fraction"
            >
              Serial f
            </th>
            <th
              scope="col"
              className="pb-2 text-right font-medium"
              title="CPU utilisation reported by Spartan"
            >
              CPU util.
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const s = t1 / r.seconds;
            const e = karpFlatt(s, r.cores);
            return (
              <tr key={r.jobId} className="border-t border-border/60 align-middle">
                <td className="py-2.5 pr-3 font-mono text-xs">
                  <span className="rounded bg-muted px-1.5 py-0.5">{r.jobId}</span>
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  {r.label}
                  <span className="block font-mono text-[0.7rem] text-muted-foreground">
                    {r.slurmScript}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-3">
                    <span className="num w-16 font-mono">{r.wallClock}</span>
                    <span className="hidden h-2 flex-1 sm:block" aria-hidden>
                      <span
                        className="block h-full rounded-r-[4px] bg-series-1"
                        style={{ width: `${(r.seconds / maxSeconds) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="num py-2.5 pr-3 text-right font-mono">{s.toFixed(2)}×</td>
                <td className="num py-2.5 pr-3 text-right font-mono">
                  {formatPct(s / r.cores, 0)}
                </td>
                <td className="num py-2.5 pr-3 text-right font-mono">
                  {Number.isNaN(e) ? "n/a" : formatPct(e, 1)}
                </td>
                <td className="num py-2.5 text-right font-mono">{r.cpuEfficiency.toFixed(2)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
