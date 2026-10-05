import {
  ArrowRight,
  ArrowUpRight,
  ChartColumn,
  Cpu,
  Gauge,
  Map as MapIcon,
  MessageSquareQuote,
  NotebookPen,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { Metric, SectionHeading } from "@/components/common/page-header";
import { JobCard } from "@/components/home/job-card";
import { GitHubMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { BENCHMARKS, DATASET, SUBJECT, TASK1, TASK2, TASK3 } from "@/lib/data/original";
import { formatBytes, formatClock, formatCompact, formatInt } from "@/lib/format";
import { gccInfo } from "@/lib/gcc";
import { SITE } from "@/lib/site";

const t1 = BENCHMARKS.find((b) => b.cores === 1)!;
const t8 = BENCHMARKS.find((b) => b.cores === 8 && b.nodes === 1)!;
const speedup = t1.seconds / t8.seconds;
const topCity = [...TASK2].sort((a, b) => b.tweets - a.tweets)[0];

const TASKS = [
  {
    n: 1,
    q: "Who tweeted the most?",
    a: `${formatInt(TASK1[0].tweets)} tweets`,
    detail: `from a single account, ${(TASK1[0].tweets / TASK1[1].tweets).toFixed(1)} times the runner-up. The top ten are ranked with ties sharing a place.`,
    href: "/results#task1",
  },
  {
    n: 2,
    q: "How many tweets came from each capital city?",
    a: `${gccInfo(topCity.gcc)?.city} ${formatCompact(topCity.tweets)}`,
    detail:
      "edges out Sydney. Place names are matched to Greater Capital Cities through a suburb gazetteer.",
    href: "/results#task2",
  },
  {
    n: 3,
    q: "Who tweeted from the most capital cities?",
    a: `${TASK3.length} authors × 8 cities`,
    detail:
      "Every one of the top ten tweeted from all eight capitals; ties are broken by total tweets.",
    href: "/results#task3",
  },
];

const EXPLORE = [
  {
    href: "/results",
    icon: MapIcon,
    title: "Results dashboard",
    body: "The three answers from the final Spartan run: a city map, the top tweeters and a city-hopper heatmap.",
  },
  {
    href: "/scaling",
    icon: Gauge,
    title: "Scaling lab",
    body: "The 1, 8 and 2×4-core benchmark jobs, speedup and efficiency, and an Amdahl's law explorer fitted to them.",
  },
  {
    href: "/lab",
    icon: Cpu,
    title: "MPI in your browser",
    body: "Generate a synthetic tweet file and crunch it with one Web Worker per rank, live, then benchmark your own cores with 95% intervals.",
  },
  {
    href: "/how-it-works",
    icon: Workflow,
    title: "How it works",
    body: "Byte-range chunking, the line scanner's magic skip counts, place matching, and the gather onto task ranks.",
  },
  {
    href: "/methods",
    icon: NotebookPen,
    title: "Methods and decisions",
    body: "Data provenance, how the benchmark and the AI feature are evaluated, the limits, and five decision records.",
  },
  {
    href: "/ask",
    icon: MessageSquareQuote,
    title: "Ask the results (optional AI)",
    body: "Bring your own key: answers drawn only from the result tables, with row citations, an audit log and a grounding evaluation.",
  },
];

const STACK = [
  { area: "Language", then: "Python 3.7", now: "TypeScript (strict)" },
  {
    area: "Parallelism",
    then: "mpi4py on Open MPI, Slurm",
    now: "Web Workers as ranks, page as the interconnect",
  },
  {
    area: "Data",
    then: "polars, pandas, NumPy",
    now: "framework-free ports with Vitest parity tests",
  },
  { area: "Platform", then: "Spartan HPC (UniMelb)", now: "Next.js 16 static site on Vercel" },
  {
    area: "Output",
    then: "CSV files and a written report",
    now: "interactive charts, map and timelines",
  },
  {
    area: "Rigour",
    then: "one run per layout",
    now: "repeated benchmark with bootstrap intervals, decision records",
  },
  {
    area: "AI",
    then: "none",
    now: "optional, bring-your-own-key, grounded and audit-logged",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* hero */}
      <section
        className="grid grid-cols-1 items-center gap-10 pt-14 pb-12 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        aria-labelledby="hero-title"
      >
        <div className="space-y-6">
          <p className="eyebrow">
            {SUBJECT.code} · {SUBJECT.name} · {SUBJECT.term}
          </p>
          <h1
            id="hero-title"
            className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Nine million tweets, <span className="text-primary">eight cores</span>, one minute{" "}
            <span className="whitespace-nowrap">forty-one</span>.
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            For COMP90024 we wrote an MPI program that split {formatBytes(DATASET.bytes)} of
            geotagged tweets across the cores of the University of Melbourne&apos;s Spartan
            supercomputer, cutting an {formatClock(t1.seconds)} job to {formatClock(t8.seconds)}.
            This site brings it back: the original answers, the scaling story, and the same
            algorithm running on your own CPU.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 px-5 text-[0.95rem]">
              <Link href="/lab">
                Run MPI in your browser <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[0.95rem]">
              <Link href="/results">
                <ChartColumn aria-hidden /> See the results
              </Link>
            </Button>
          </div>
        </div>
        <JobCard />
      </section>

      <dl className="panel grid grid-cols-2 gap-6 p-5 sm:p-6 md:grid-cols-4">
        <Metric
          label="Tweets"
          value={formatCompact(DATASET.tweets)}
          hint={`by ${formatInt(DATASET.authors)} authors`}
        />
        <Metric
          label="Input"
          value={formatBytes(DATASET.bytes)}
          hint="one pretty-printed JSON file"
        />
        <Metric
          label="Speedup"
          value={`${speedup.toFixed(1)}×`}
          hint={`${formatClock(t1.seconds)} → ${formatClock(t8.seconds)} on 8 cores`}
          tone="primary"
        />
        <Metric
          label="Busiest city"
          value={gccInfo(topCity.gcc)?.city ?? topCity.gcc}
          hint={`${formatInt(topCity.tweets)} tweets`}
          tone="signal"
        />
      </dl>

      {/* the brief */}
      <section className="mt-20" aria-labelledby="brief">
        <SectionHeading
          id="brief"
          eyebrow="The assignment"
          title="Three questions, one very large file"
        >
          <p>
            Each student pair had to build a parallel program for Spartan that reads a large Twitter
            dataset together with a gazetteer of Australian suburbs, answers three questions, and
            runs on 1 node × 1 core, 1 node × 8 cores and 2 nodes × 4 cores, then explain the
            timings. Our answers:
          </p>
        </SectionHeading>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TASKS.map((t) => (
            <Link
              key={t.n}
              href={t.href}
              className="panel group flex flex-col p-5 transition-colors hover:border-primary/50"
            >
              <span className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
                Task {t.n}
              </span>
              <span className="mt-2 font-heading text-lg font-semibold">{t.q}</span>
              <span className="num mt-4 font-heading text-2xl font-semibold text-primary">
                {t.a}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{t.detail}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Details{" "}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* approach */}
      <section
        className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
        aria-labelledby="approach"
      >
        <SectionHeading id="approach" eyebrow="What we built" title="Read bytes, not JSON">
          <p>
            Parsing 18.7 GB of JSON on one core is slow, and it does not split well. So the program
            treats the file as bytes: each rank seeks to its own offset, scans lines with three
            regular expressions, and skips the fields it does not need using fixed line counts.
          </p>
          <p className="mt-3">
            Only small count tables travel between ranks at the end, which is why two 4-core nodes
            ran as fast as one 8-core node.
          </p>
          <Link href="/how-it-works" className="link mt-4 inline-flex items-center gap-1">
            Walk through the algorithm <ArrowRight className="size-4" aria-hidden />
          </Link>
        </SectionHeading>
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ["Split", "split_file_into_chunks gives each rank an equal byte range."],
            [
              "Scan",
              "twitter_processorV1 reads _id, author_id and full_name, skipping 2, 18 and 20 lines.",
            ],
            ["Match", "Place names are normalised and their word n-grams looked up in sal.json."],
            ["Reduce", "Ranks 0, 1 and 2 gather the partial tables and write one CSV each."],
          ].map(([title, body], i) => (
            <li key={title} className="panel p-4">
              <span className="font-mono text-xs text-primary">0{i + 1}</span>
              <p className="mt-1 font-heading font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* explore */}
      <section className="mt-20" aria-labelledby="explore">
        <SectionHeading id="explore" eyebrow="Explore" title="Six ways in" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {EXPLORE.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="panel group flex gap-4 p-5 transition-colors hover:border-primary/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <e.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="flex items-center gap-1 font-heading text-lg font-semibold">
                  {e.title}
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{e.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* about */}
      <section
        className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
        aria-labelledby="about"
      >
        <div className="space-y-4">
          <SectionHeading id="about" eyebrow="About this project" title="Coursework, revived" />
          <dl className="space-y-3 text-sm">
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <dt className="text-muted-foreground">Subject</dt>
              <dd>
                {SUBJECT.code} {SUBJECT.name}
              </dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <dt className="text-muted-foreground">University</dt>
              <dd>{SUBJECT.university}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <dt className="text-muted-foreground">When</dt>
              <dd>{SUBJECT.term}, Assignment 1 (social media analytics on Spartan)</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <dt className="text-muted-foreground">Team</dt>
              <dd>
                Sunchuangyu (Rin) Huang{" "}
                <a
                  href="https://github.com/rNLKJA"
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                >
                  @rNLKJA
                </a>{" "}
                and Wei Zhao
              </dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <dt className="text-muted-foreground">Source</dt>
              <dd>
                <a
                  href={SITE.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="link inline-flex items-center gap-1.5"
                >
                  <GitHubMark className="size-3.5" /> rNLKJA/Twitter-Data-Analysis-with-HPC
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </dd>
            </div>
          </dl>
          <p className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Academic integrity.</strong> The
            original 2023 submission is kept for reference in the repository&apos;s{" "}
            <code className="font-mono">coursework/</code> folder, with its analysis logic unchanged
            (it has since been reformatted with black and isort, and a hard-coded email credential
            was moved to environment variables). The assignment brief, the course datasets and the
            written report are not reproduced here; the task is paraphrased. If you are taking
            COMP90024, please do your own work.
          </p>
        </div>
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <caption className="border-b px-4 py-3 text-left font-heading font-semibold">
              Original stack vs revived stack
            </caption>
            <thead>
              <tr className="text-left font-mono text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                <th scope="col" className="px-4 pt-3 pb-2 font-medium">
                  <span className="sr-only">Area</span>
                </th>
                <th scope="col" className="px-4 pt-3 pb-2 font-medium">
                  2023
                </th>
                <th scope="col" className="px-4 pt-3 pb-2 font-medium text-primary">
                  2026
                </th>
              </tr>
            </thead>
            <tbody>
              {STACK.map((s) => (
                <tr key={s.area} className="border-t border-border/60 align-top">
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left font-mono text-xs font-normal text-muted-foreground"
                  >
                    {s.area}
                  </th>
                  <td className="px-4 py-2.5">{s.then}</td>
                  <td className="px-4 py-2.5">{s.now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
