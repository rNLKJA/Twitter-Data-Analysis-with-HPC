import { ArrowRight, FileText, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader, Panel, SectionHeading } from "@/components/common/page-header";
import { Markdown } from "@/components/methods/markdown";
import { fitSerialFraction, serialFractionRoundingRange } from "@/lib/amdahl";
import { EVAL_ITEMS } from "@/lib/ai/ask/eval";
import { listDecisions, readDoc, withoutTitle } from "@/lib/content/docs";
import { BENCHMARKS, DATASET, DEV_BENCHMARKS } from "@/lib/data/original";
import { formatBytes, formatInt, formatPct } from "@/lib/format";
import { BENCHMARK_DEFAULTS, MIN_INTERVAL_ROUNDS } from "@/lib/lab/benchmark";
import { BOOTSTRAP_DEFAULTS } from "@/lib/stats/bootstrap";
import { medianInterval } from "@/lib/stats/order";

/** Exact coverage of the order-statistic median interval at the default round count. */
const defaultMedianCoverage = medianInterval([
  ...Array(BENCHMARK_DEFAULTS.repeats).keys(),
]).coverage;

export const metadata: Metadata = {
  title: "Methods",
  description:
    "Data provenance, method, evaluation design, assumptions and limitations of the COMP90024 tweet cruncher revival, with decision records, a model card and the AI use statement.",
};

const TOC = [
  ["provenance", "Data provenance"],
  ["method", "Method"],
  ["evaluation", "Evaluation design"],
  ["assumptions", "Assumptions"],
  ["limitations", "Limitations"],
  ["change", "What I'd change"],
  ["decisions", "Decision records"],
  ["model-card", "Model card"],
  ["ai-use", "AI use statement"],
] as const;

function fit(runs: typeof BENCHMARKS) {
  const t1 = runs.find((r) => r.cores === 1)!.seconds;
  return fitSerialFraction(
    runs.filter((r) => r.cores > 1).map((r) => ({ n: r.cores, s: t1 / r.seconds })),
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-14 scroll-mt-24 space-y-4" aria-labelledby={id}>
      <SectionHeading id={id} eyebrow={eyebrow} title={title} />
      <div className="max-w-3xl space-y-3 text-[0.95rem] leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export default function MethodsPage() {
  const decisions = listDecisions();
  const aiUse = withoutTitle(readDoc("ai-use-statement.md"));
  const t1 = BENCHMARKS.find((b) => b.cores === 1)!.seconds;
  const t8 = BENCHMARKS.find((b) => b.cores === 8 && b.nodes === 1)!.seconds;
  const [rLo, rHi] = serialFractionRoundingRange(t1, t8, 8);
  const answerable = EVAL_ITEMS.filter((i) => i.answerable).length;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        eyebrow="Methods · how the numbers were made"
        title="Methods, decisions and limits"
      >
        <p>
          Where every number on this site comes from, how the 2023 program and its 2026 port were
          checked, how the browser benchmark and the AI feature are evaluated, and what all of it
          cannot tell you.
        </p>
      </PageHeader>

      <nav aria-label="On this page" className="panel p-4">
        <p className="eyebrow mb-2">On this page</p>
        <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          {TOC.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="text-muted-foreground hover:text-foreground">
                <span className="mr-2 font-mono text-xs text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="provenance" eyebrow="Data" title="Data provenance">
        <p>
          No course data is hosted or re-analysed here. Each artefact below says where it came from
          and whether it can be regenerated.
        </p>
        <p className="text-xs text-muted-foreground sm:hidden">
          Swipe the table sideways for the sources.
        </p>
        <div
          className="overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-label="Data provenance table, scrollable"
        >
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted/30 text-left font-mono text-[0.68rem] tracking-[0.08em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Artefact
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Source
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Re-runnable?
                </th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t">
                <td className="px-3 py-2">Task 1 to 3 results, dataset summary</td>
                <td className="px-3 py-2">
                  Transcribed from the 2023 submission ({formatBytes(DATASET.bytes)},{" "}
                  {formatInt(DATASET.tweets)} tweets). Task 1 author ids are as printed, with
                  trailing digits lost to a spreadsheet.
                </td>
                <td className="px-3 py-2">No: the course data lived only on Spartan.</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Spartan benchmark jobs</td>
                <td className="px-3 py-2">
                  Final jobs {BENCHMARKS[0].jobId} to {BENCHMARKS[2].jobId} from the submission;
                  earlier jobs {DEV_BENCHMARKS[0].jobId} to {DEV_BENCHMARKS[2].jobId} from the Slurm
                  logs on the <Code>Spartan-running-test</Code> branch. Wall clock in whole seconds,
                  one run per layout.
                </td>
                <td className="px-3 py-2">No.</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Place gazetteer (117 keys)</td>
                <td className="px-3 py-2">
                  The original <Code>process_salV1</Code> run on <Code>sal.json</Code> by{" "}
                  <Code>scripts/build_gazetteer.py</Code>, restricted to keys the demo can hit.
                </td>
                <td className="px-3 py-2">Yes, with the course&apos;s sal.json.</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Synthetic tweet files</td>
                <td className="px-3 py-2">
                  Seeded generator with bigTwitter.json&apos;s line layout (
                  <Link href="/methods/decisions/DR-003-synthetic-data-design" className="link">
                    DR-003
                  </Link>
                  ).
                </td>
                <td className="px-3 py-2">Yes: same seed, same bytes.</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Parity fixtures</td>
                <td className="px-3 py-2">
                  The original Python run outside Spartan on synthetic files by{" "}
                  <Code>scripts/run_original.py</Code>.
                </td>
                <td className="px-3 py-2">Yes, with uv and sal.json.</td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Browser benchmark samples</td>
                <td className="px-3 py-2">
                  Your own runs in the MPI lab; exported as CSV or JSON.
                </td>
                <td className="px-3 py-2">Yes, on your machine.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="method" eyebrow="Method" title="The program and its port">
        <p>
          The 2023 program splits the file into equal byte ranges, one per MPI rank (
          <Link href="/methods/decisions/DR-001-byte-range-chunking" className="link">
            DR-001
          </Link>
          ); each rank scans its range line by line with three regular expressions, matches place
          names to Greater Capital Cities through n-grams of the normalised name, and reduces its
          tweets to three count tables, which are sent to ranks 0, 1 and 2 for the final answers (
          <Link href="/methods/decisions/DR-002-gather-strategy" className="link">
            DR-002
          </Link>
          ). The step-by-step version is on{" "}
          <Link href="/how-it-works" className="link">
            How it works
          </Link>
          .
        </p>
        <p>
          The 2026 revival ports the algorithm to TypeScript, quirks included, and runs it with one
          Web Worker per rank. The original Python is run outside Spartan on the same synthetic
          inputs to produce reference outputs, and the test suite requires the port to match them:
          per-tweet records and per-rank counts for 1, 3, 4 and 7 ranks, all four result files, the
          boundary double count at 27 and 39 ranks, and the UTF-8 decode crash at 17 and 29 ranks.
        </p>
      </Section>

      <Section id="evaluation" eyebrow="Evaluation" title="Evaluation design">
        <h3 className="font-heading text-lg font-semibold">Correctness</h3>
        <p>
          Correctness is tested, not sampled: the parity tests above are exact comparisons, and
          every run in the lab is checked against the first run on the same file that counted no
          tweet twice.
        </p>
        <h3 id="benchmark" className="scroll-mt-24 font-heading text-lg font-semibold">
          Performance
        </h3>
        <p>
          <strong>Spartan, 2023.</strong> Three layouts, one run each, timed in whole seconds. The
          8-core speedup was {(t1 / t8).toFixed(2)}×, and Amdahl&apos;s serial fraction fitted to
          the final runs is {formatPct(fit(BENCHMARKS), 2)}. Because both multi-core layouts used 8
          cores, the fit is the Karp–Flatt value at n = 8, a point estimate: there is no repeat from
          which to estimate run-to-run spread, so no interval can be given. Rounding to whole
          seconds alone moves it between {formatPct(rLo, 2)} and {formatPct(rHi, 2)}.
        </p>
        <p>
          <strong>Browser benchmark, 2026</strong> (
          <Link href="/methods/decisions/DR-004-benchmark-protocol" className="link">
            DR-004
          </Link>
          ). {BENCHMARK_DEFAULTS.warmupRounds} warm-up round discarded, then{" "}
          {BENCHMARK_DEFAULTS.repeats} timed rounds by default; every worker count once per round,
          in an order shuffled with seed {BENCHMARK_DEFAULTS.orderSeed}. Reported per worker count:
          the median wall time with its exact order-statistic interval, which needs no assumption
          about the shape of the noise and whose true coverage is shown (
          {formatPct(defaultMedianCoverage, 1)} at the default {BENCHMARK_DEFAULTS.repeats} rounds);
          then speedup (ratio of medians), efficiency and the Karp–Flatt fraction, each with a
          percentile bootstrap interval ({formatInt(BOOTSTRAP_DEFAULTS.resamples)} resamples of
          whole rounds, seed {BOOTSTRAP_DEFAULTS.seed}). Amdahl&apos;s f is a least-squares fit to
          the median speedups, with its interval from the same resamples. Bootstrap intervals are
          labelled nominal 95%: a seeded simulation put their coverage at 94% to 95% with 5 or 7
          rounds and 96% to 98% with 10 or 15, and no interval is shown with fewer than{" "}
          {MIN_INTERVAL_ROUNDS} complete rounds. Gustafson&apos;s law (n − f(n − 1)) is drawn with
          the same f for contrast: it assumes the input grows with n, whereas the lab keeps it
          fixed.
        </p>
        <p>
          The statistics are unit-tested against values computed independently with numpy, scipy and
          statsmodels (<Code>scripts/stats_reference.py</Code>, which replays the seeded bootstrap
          draw for draw) and with base R (<Code>scripts/stats_reference.R</Code>). The coverage
          simulation is <Code>web/src/lib/lab/coverage.ts</Code>, run with{" "}
          <Code>pnpm coverage-sim</Code>.
        </p>
        <h3 className="font-heading text-lg font-semibold">The optional AI feature</h3>
        <p>
          <Link href="/ask" className="link">
            Ask the results
          </Link>{" "}
          is evaluated on {EVAL_ITEMS.length} fixed questions ({answerable} answerable,{" "}
          {EVAL_ITEMS.length - answerable} not) with an answer key computed in code from the same
          tables; numbers the question already contains do not count as evidence. Every item a run
          reached is scored, so a call that fails on an item counts as a fail instead of dropping
          out of the denominator. Rates, including the call-error rate, are reported with Wilson 95%
          intervals; two runs can be compared item by item with a paired bootstrap interval and an
          exact McNemar test, with a warning when their request settings differ (
          <Link href="/methods/decisions/DR-005-grounded-answers" className="link">
            DR-005
          </Link>
          ). No scores are published here: running it costs money on a visitor&apos;s key, and a
          score the author ran and reported would be a self-scored metric.
        </p>
      </Section>

      <Section id="assumptions" eyebrow="Assumptions" title="What the analysis assumes">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            The transcribed results match what the 2023 program wrote; they cannot be re-derived.
          </li>
          <li>
            Amdahl&apos;s law describes this program&apos;s strong scaling: a constant serial part
            plus work that divides evenly over n workers.
          </li>
          <li>
            In the browser, a Web Worker per rank on a machine with at least that many logical cores
            behaves like an MPI rank on its own core, and the page relaying tables stands in for MPI
            send and receive.
          </li>
          <li>
            Benchmark rounds are exchangeable: conditions within a session do not change in a way
            the shuffled order cannot spread out.
          </li>
          <li>
            For the AI feature, the tables are the whole truth: a question they cannot answer should
            be declined, even if the model knows the answer elsewhere.
          </li>
        </ul>
      </Section>

      <Section id="limitations" eyebrow="Limitations" title="What it cannot tell you">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Spartan&apos;s serial fraction is a single point at n = 8. It cannot distinguish
            Amdahl&apos;s law from any other curve through that point, and its ceiling of about{" "}
            {(1 / fit(BENCHMARKS)).toFixed(0)}× is an extrapolation.
          </li>
          <li>
            The browser is not Spartan: memory instead of a shared file system, no network, a
            browser scheduler, logical cores that include hyper-threads or efficiency cores, and a
            synthetic file with shorter records and fewer tweets per author (
            <Link href="/methods/decisions/DR-003-synthetic-data-design" className="link">
              DR-003
            </Link>
            ). The lab also runs the three reductions in parallel, which the 2023 code did not (
            <Link href="/methods/decisions/DR-002-gather-strategy" className="link">
              DR-002
            </Link>
            ).
          </li>
          <li>
            The intervals describe spread on one machine in one session, assuming runs are
            independent. Between sessions the same machine varied more than any one interval (
            <Link href="/methods/decisions/DR-004-benchmark-protocol" className="link">
              DR-004
            </Link>
            ).
          </li>
          <li>
            Two 2023 bugs are kept on purpose for fidelity: a chunk boundary inside an{" "}
            <Code>&quot;_id&quot;</Code> line&apos;s indentation double-counts a tweet (about 1 in
            515 per boundary on bigTwitter.json), and a boundary inside a multi-byte character
            crashes a rank. Whether the double count affected the 2023 runs is unknown.
          </li>
          <li>
            The AI evaluation is small (24 items), written by the same person as the prompt, and
            graded by literal number matching; it is a check on grounding behaviour, not a model
            ranking.
          </li>
        </ul>
      </Section>

      <Section id="change" eyebrow="Next time" title="What I'd change">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            On Spartan: repeat each layout at least five times, add 2, 4 and 16 cores, and log the
            time of every phase on every rank, so the serial fraction is measured with an interval
            instead of inferred from one point.
          </li>
          <li>
            Snap chunk boundaries to record starts, which removes both boundary bugs (
            <Link href="/methods/decisions/DR-001-byte-range-chunking" className="link">
              DR-001
            </Link>
            ), and post the three gathers as non-blocking sends so the reductions really overlap.
          </li>
          <li>
            Calibrate the synthetic data to the published ratios (about 76 tweets per author and 2
            kB per tweet) so the lab&apos;s balance of scanning and reducing is closer to
            Spartan&apos;s.
          </li>
          <li>
            Fit and compare a model with a communication term that grows with n, and show residuals.
          </li>
          <li>Have someone else write a held-out question set for the AI evaluation.</li>
        </ul>
      </Section>

      <section className="mt-14 scroll-mt-24 space-y-4" aria-labelledby="decisions">
        <SectionHeading id="decisions" eyebrow="Decision records" title="Why it was built this way">
          <p>
            One record per decision, in a fixed format: context, decision, options considered, why,
            what happened (weak numbers included) and what I&apos;d change. Records are never edited
            after the fact; a later record supersedes an earlier one.
          </p>
        </SectionHeading>
        <ol className="grid gap-3 md:grid-cols-2">
          {decisions.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/methods/decisions/${d.slug}`}
                className="panel group flex h-full flex-col gap-2 p-4 transition-colors hover:border-primary/50"
              >
                <span className="font-mono text-xs text-primary">{d.id}</span>
                <span className="font-heading font-semibold">{d.title}</span>
                <span className="line-clamp-3 text-sm text-muted-foreground">{d.summary}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read the record
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 scroll-mt-24" aria-labelledby="model-card">
        <Panel as="div" className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Scale className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 id="model-card" className="font-heading text-lg font-semibold tracking-tight">
              Model card
            </h2>
            <p className="text-sm text-muted-foreground">
              Intended use, data, evaluation with its limits, failure modes and ethical
              considerations for the Amdahl scaling model and the grounded question answering.
            </p>
          </div>
          <Link
            href="/methods/model-card"
            className="link inline-flex shrink-0 items-center gap-1 sm:ml-auto"
          >
            <FileText className="size-4" aria-hidden /> Read the model card
          </Link>
        </Panel>
      </section>

      <section className="mt-14 scroll-mt-24 space-y-4" aria-labelledby="ai-use">
        <SectionHeading id="ai-use" eyebrow="Transparency" title="AI use statement" />
        <article className="panel p-5 sm:p-7">
          <Markdown source={aiUse} nestedHeadings />
        </article>
      </section>
    </div>
  );
}
