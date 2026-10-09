import { Network, Scale, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Metric, PageHeader, Panel, SectionHeading } from "@/components/common/page-header";
import { AmdahlExplorer } from "@/components/scaling/amdahl-explorer";
import { BenchmarkTable } from "@/components/scaling/benchmark-table";
import { amdahlLimit, fitSerialFraction, serialFractionRoundingRange } from "@/lib/amdahl";
import { BENCHMARKS, DATASET, DEV_BENCHMARKS, type BenchmarkRun } from "@/lib/data/original";
import { formatBytes, formatClock, formatPct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Scaling lab",
  description:
    "Spartan benchmark runs of the MPI tweet cruncher (1×1, 1×8, 2×4 cores), speedup and efficiency, and an interactive Amdahl's law explorer fitted to the measured runs.",
};

function stats(runs: readonly BenchmarkRun[]) {
  const t1 = runs.find((r) => r.cores === 1)!;
  const t8 = runs.find((r) => r.cores === 8 && r.nodes === 1)!;
  const s = t1.seconds / t8.seconds;
  const f = fitSerialFraction(
    runs.filter((r) => r.cores > 1).map((r) => ({ n: r.cores, s: t1.seconds / r.seconds })),
  );
  return { t1, t8, s, f, limit: amdahlLimit(f) };
}

export default function ScalingPage() {
  const final = stats(BENCHMARKS);
  const earlier = stats(DEV_BENCHMARKS);
  const twoNode = BENCHMARKS.find((r) => r.nodes === 2)!;
  const throughput = DATASET.bytes / final.t1.seconds;
  const [roundLo, roundHi] = serialFractionRoundingRange(final.t1.seconds, final.t8.seconds, 8);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        eyebrow="Scaling lab · Spartan, April 2023"
        title={`Eight cores, ${final.s.toFixed(1)} times faster`}
      >
        <p>
          The assignment required the same job on three Slurm layouts: 1 node × 1 core, 1 node × 8
          cores and 2 nodes × 4 cores. These are the measured wall-clock times for{" "}
          {formatBytes(DATASET.bytes)} of tweets, what they say about the serial share of the
          program, and what more cores would have bought.
        </p>
      </PageHeader>

      <dl className="panel grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Metric
          label="1 core"
          value={formatClock(final.t1.seconds)}
          hint={`${formatBytes(throughput)}/s single-core scan`}
        />
        <Metric
          label="8 cores"
          value={formatClock(final.t8.seconds)}
          hint="1 node × 8 or 2 nodes × 4"
          tone="primary"
        />
        <Metric
          label="Speedup"
          value={`${final.s.toFixed(2)}×`}
          hint={`${formatPct(final.s / 8, 0)} parallel efficiency`}
        />
        <Metric
          label="Serial fraction"
          value={formatPct(final.f, 1)}
          hint={`caps speedup at ${final.limit.toFixed(0)}×`}
          tone="signal"
        />
      </dl>

      <section className="mt-12 space-y-4" aria-labelledby="runs">
        <SectionHeading id="runs" eyebrow="Measured" title="The benchmark jobs">
          <p>
            Speedup and efficiency are relative to the 1-core job; the serial fraction is the
            Karp–Flatt metric, which inverts Amdahl&apos;s law for a single measurement. CPU
            utilisation is Spartan&apos;s own job statistic.
          </p>
        </SectionHeading>
        <Panel title="Final submission" description="bigTwitter.json, jobs 46094405–07">
          <BenchmarkTable runs={BENCHMARKS} caption="Final benchmark jobs on Spartan" />
        </Panel>
        <Panel
          title="Earlier revision"
          description="Same file and layouts on 2 April 2023, before the final optimisations (Slurm logs on the Spartan-running-test branch)"
        >
          <BenchmarkTable runs={DEV_BENCHMARKS} caption="Earlier benchmark jobs on Spartan" />
        </Panel>
      </section>

      <section className="mt-16 space-y-6" aria-labelledby="explore">
        <SectionHeading id="explore" eyebrow="Model" title="Fit Amdahl's law, then push it">
          <p>
            Amdahl&apos;s law says that if a fraction <i>f</i> of a job is inherently serial,{" "}
            <i>n</i> workers can at best speed it up by 1 / (<i>f</i> + (1 − <i>f</i>) / <i>n</i>).
            Fitted to our runs, the curve explains why eight cores gave {final.s.toFixed(1)}× rather
            than 8×.
          </p>
        </SectionHeading>
        <AmdahlExplorer />
      </section>

      <section className="mt-16" aria-labelledby="lessons">
        <SectionHeading
          id="lessons"
          eyebrow="Reading the numbers"
          title="Three things the benchmarks show"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel as="div" className="space-y-2">
            <Timer className="size-5 text-primary" aria-hidden />
            <h3 className="font-heading font-semibold">Serial work sets the ceiling</h3>
            <p className="text-sm text-muted-foreground">
              Every rank starts Python, imports polars and pandas and builds the full sal.json
              dictionary before it reads a byte of tweets, and the task ranks merge the partial
              tables at the end. That {formatPct(final.f, 1)} does not shrink with more cores, so
              the model tops out near {final.limit.toFixed(0)}×.
            </p>
          </Panel>
          <Panel as="div" className="space-y-2">
            <Scale className="size-5 text-primary" aria-hidden />
            <h3 className="font-heading font-semibold">Faster code scaled worse</h3>
            <p className="text-sm text-muted-foreground">
              The earlier revision took {formatClock(earlier.t1.seconds)} on one core but reached{" "}
              {earlier.s.toFixed(1)}× on eight (serial share {formatPct(earlier.f, 1)}). The final
              revision precompiled its regexes and reworked the read loop (the gather only moved
              into a helper, with the same messages), and its one-core time halved. The logs cannot
              say how much of that came from the code rather than the node or the file cache, but
              either way the fixed costs became a bigger slice of each run: Amdahl&apos;s law in
              practice.
            </p>
          </Panel>
          <Panel as="div" className="space-y-2">
            <Network className="size-5 text-primary" aria-hidden />
            <h3 className="font-heading font-semibold">A second node was free</h3>
            <p className="text-sm text-muted-foreground">
              2 nodes × 4 cores ran in {formatClock(twoNode.seconds)}, the same as one 8-core node.
              Ranks only exchange small per-author and per-city count tables at the end, never
              tweets, so the slower inter-node link barely registers.
            </p>
          </Panel>
        </div>
        <Panel as="div" className="mt-6 space-y-2">
          <h3 id="certainty" className="font-heading font-semibold">
            How sure is {formatPct(final.f, 1)}?
          </h3>
          <p className="text-sm text-muted-foreground">
            Not very, and the data cannot say how unsure. The benchmark is three configurations with
            one run each, and both multi-core layouts used 8 cores, so the fitted serial fraction is
            the Karp–Flatt value at a single point (n = 8): a point estimate with no repeat from
            which to estimate run-to-run spread, and no way to tell Amdahl&apos;s law from any other
            curve through that point. Slurm&apos;s whole-second timing alone moves it between{" "}
            {formatPct(roundLo, 2)} and {formatPct(roundHi, 2)}; the {final.limit.toFixed(0)}×
            ceiling is an extrapolation. The{" "}
            <Link href="/lab" className="link">
              MPI lab&apos;s benchmark
            </Link>{" "}
            repeats every configuration and reports intervals instead (
            <Link href="/methods#benchmark" className="link">
              method
            </Link>
            ).
          </p>
        </Panel>
        <p className="mt-6 text-sm text-muted-foreground">
          Want to measure this yourself?{" "}
          <Link href="/lab" className="link">
            The MPI lab
          </Link>{" "}
          runs the same chunk-and-gather design on your machine&apos;s cores and fits the same curve
          to your runs.
        </p>
      </section>
    </div>
  );
}
