import { BENCHMARKS } from "@/lib/data/original";

const JOB = BENCHMARKS.find((b) => b.cores === 8 && b.nodes === 1)!;

/** Hero visual: the 8-core Slurm job, with one lane per rank scanning its byte range. */
export function JobCard() {
  return (
    <div className="panel relative overflow-hidden p-0 shadow-xl shadow-primary/5">
      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-3 font-mono text-[0.68rem] text-muted-foreground">
          spartan-login · ~/comp90024-a1
        </span>
      </div>
      <pre className="overflow-x-auto px-4 pt-4 pb-2 font-mono text-[0.72rem] leading-relaxed sm:text-xs">
        <code>
          <span className="text-muted-foreground">$ </span>sbatch slurm/{JOB.slurmScript}
          {"\n"}
          <span className="text-muted-foreground">Submitted batch job </span>
          <span className="text-primary">{JOB.jobId}</span>
          {"\n\n"}
          <span className="text-muted-foreground">$ </span>mpiexec -n 8 python main.py -t
          bigTwitter.json -s sal.json
          {"\n"}
        </code>
      </pre>
      <div className="space-y-1.5 px-4 pb-3" aria-hidden>
        {Array.from({ length: 8 }, (_, r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="w-11 font-mono text-[0.65rem] text-muted-foreground">rank {r}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 w-full rounded-full bg-series-1/25" />
              <div
                className="absolute inset-y-0 left-0 w-1/3 animate-scan rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
                style={{ animationDelay: `${(r * 0.17) % 1.2}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-3 border-t font-mono text-[0.68rem]">
        <div className="border-r px-4 py-3">
          <dt className="text-muted-foreground">Wall-clock</dt>
          <dd className="num mt-0.5 text-sm text-foreground">{JOB.wallClock}</dd>
        </div>
        <div className="border-r px-4 py-3">
          <dt className="text-muted-foreground">Cores</dt>
          <dd className="num mt-0.5 text-sm text-foreground">1 node × 8</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-muted-foreground">CPU util.</dt>
          <dd className="num mt-0.5 text-sm text-foreground">{JOB.cpuEfficiency}%</dd>
        </div>
      </dl>
    </div>
  );
}
