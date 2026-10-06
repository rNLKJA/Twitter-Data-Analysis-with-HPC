import { ArrowRight, Combine, FileSearch, MapPin, Scissors, Send, Sigma } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader, Panel, SectionHeading } from "@/components/common/page-header";
import { ChunkExplorer } from "@/components/how/chunk-explorer";
import { PlaceMatcher } from "@/components/how/place-matcher";
import { ScannerTrace } from "@/components/how/scanner-trace";
import { Button } from "@/components/ui/button";
import { SKIP_AFTER_ID, SKIP_LINES_1, SKIP_LINES_2 } from "@/lib/cruncher/constants";
import { DATASET } from "@/lib/data/original";
import { formatInt } from "@/lib/format";
import { traceScanner } from "@/lib/cruncher/trace";
import { generateSyntheticFile } from "@/lib/synth/generator";

import gazetteer from "../../../public/data/gazetteer.json";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Inside the COMP90024 MPI tweet cruncher: byte-range chunking, a line scanner with magic skip counts, n-gram place matching against sal.json, and the gather-and-reduce onto task ranks.",
};

const STEPS = [
  { icon: Scissors, title: "Split", body: "Cut the file into equal byte ranges, one per rank." },
  {
    icon: FileSearch,
    title: "Scan",
    body: "Each rank seeks to its offset and line-scans with three regexes.",
  },
  {
    icon: MapPin,
    title: "Match",
    body: "Normalise each place name and look its n-grams up in sal.json.",
  },
  {
    icon: Sigma,
    title: "Count",
    body: "Group-by on the rank: per author, per city, per author-city pair.",
  },
  { icon: Send, title: "Gather", body: "Send the small partial tables to ranks 0, 1 and 2." },
  {
    icon: Combine,
    title: "Reduce",
    body: "Sum, rank and write task1.csv, task2.csv and task3.csv.",
  },
];

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

export default function HowItWorksPage() {
  const sample = new TextDecoder().decode(generateSyntheticFile({ seed: 2023, tweets: 3 }));
  const dict = new Map(Object.entries(gazetteer.dict as Record<string, string>));
  const trace = traceScanner(sample, dict, 2);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="How it works" title="One file, many ranks, three small tables">
        <p>
          bigTwitter.json was too big to load into memory and too slow to parse as JSON on one core.
          The program never parses it: every MPI rank reads only its own slice of bytes, pulls out
          three fields with regular expressions, and ships tiny count tables back for the final
          answer.
        </p>
      </PageHeader>

      <ol
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        aria-label="Pipeline steps"
      >
        {STEPS.map((s, i) => (
          <li key={s.title} className="panel relative p-4">
            <span className="font-mono text-[0.65rem] text-muted-foreground">0{i + 1}</span>
            <s.icon className="mt-2 size-5 text-primary" aria-hidden />
            <p className="mt-2 font-heading font-semibold">{s.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <section
        className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
        aria-labelledby="split"
      >
        <SectionHeading
          id="split"
          eyebrow="01 · split_file_into_chunks"
          title="Byte ranges, not lines"
        >
          <p>
            Counting lines would mean reading the whole file first, so the program divides its{" "}
            <em>byte size</em> instead. A boundary will usually land in the middle of a tweet, and
            two rules make that safe:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              A rank keeps reading past its <Code>chunk_end</Code> until its last tweet has a place,
              so it always finishes what it started.
            </li>
            <li>
              A rank that starts mid-tweet never saw that tweet&apos;s <Code>_id</Code>, so the
              author and place lines that follow are ignored: its counters are already level.
            </li>
          </ul>
          <p className="mt-3">
            So every tweet is counted by exactly one rank, with one exception we only found while
            porting. If a cut lands inside the four spaces of indentation before{" "}
            <Code>&quot;_id&quot;</Code>, the next rank&apos;s partial first line still matches the
            regex, and both ranks count that tweet. At about 2 kB per tweet that is a 1 in 500
            chance per boundary on bigTwitter.json. The original Python does it too, so the port
            keeps the bug and a parity test pins it; the lab flags it when one of your runs hits it.
          </p>
        </SectionHeading>
        <ChunkExplorer />
      </section>

      <section className="mt-16 space-y-6" aria-labelledby="scan">
        <SectionHeading
          id="scan"
          eyebrow="02 · twitter_processorV1"
          title="A line scanner with magic numbers"
        >
          <p>
            The file is pretty-printed JSON, one field per line, with a fixed layout. After finding
            a tweet&apos;s <Code>_id</Code> the scanner skips {SKIP_AFTER_ID} lines; after{" "}
            <Code>author_id</Code> it skips {SKIP_LINES_1}; after <Code>full_name</Code> it skips{" "}
            {SKIP_LINES_2}. Those counts (commented <Code># MAGICS NUMBERS</Code> in the original)
            jump over text and metadata without even running a regex on them. Below is the real
            trace of the ported scanner over the first two tweets of a synthetic file.
          </p>
        </SectionHeading>
        <ScannerTrace lines={trace.lines} readCount={trace.readCount} skipCount={trace.skipCount} />
      </section>

      <section
        className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
        aria-labelledby="match"
      >
        <SectionHeading
          id="match"
          eyebrow="03 · normalise_location + sal_dict"
          title="From a place name to a capital city"
        >
          <p>
            <Code>sal.json</Code> maps {formatInt(DATASET.salEntries)} suburb and locality names to
            Greater Capital City codes such as <Code>2gmel</Code>, or rural codes such as{" "}
            <Code>2rvic</Code>. The program cleans the keys (brackets, &ldquo; - &rdquo; and full
            stops removed), adds every word pair of names longer than two words, and builds a{" "}
            {formatInt(gazetteer.source.fullDictionaryKeys)}-key dictionary.
          </p>
          <p className="mt-3">
            Each tweet&apos;s place is lower-cased and normalised, then every combination of its
            words is tried, shortest first. The first key that exists wins. It is fast and usually
            right, and the port keeps its quirks: try <em>Macquarie Park, Sydney</em>.
          </p>
        </SectionHeading>
        <PlaceMatcher />
      </section>

      <section className="mt-16" aria-labelledby="reduce">
        <SectionHeading
          id="reduce"
          eyebrow="04 · gather_task_tdf + reductions"
          title="Gather onto three task ranks"
        >
          <p>
            Each rank turns its tweets into three partial tables. Rather than sending everything to
            rank 0, the program spreads the reductions: rank 0 hosts Task 1, rank 1 Task 2 and rank
            2 Task 3. Each host receives its own table first, then one from every other rank in
            order, and writes one CSV.
          </p>
        </SectionHeading>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Panel as="div" title="Task 1 on rank 0" description="author_id → tweet count">
            <p className="text-sm text-muted-foreground">
              Sum counts per author, rank with ties sharing the best place (
              <Code>method=&quot;min&quot;</Code>), keep rank ≤ 10. Ties can therefore produce more
              than ten rows.
            </p>
          </Panel>
          <Panel as="div" title="Task 2 on rank 1" description="gcc → tweet count">
            <p className="text-sm text-muted-foreground">
              Drop unmatched tweets and rural codes (<Code>\dr[a-z]{"{3}"}</Code>), sum per capital
              city, sort by code. &ldquo;Other Territories&rdquo; (<Code>9oter</Code>) is not rural,
              so it stays.
            </p>
          </Panel>
          <Panel as="div" title="Task 3 on rank 2" description="(author_id, gcc) → tweet count">
            <p className="text-sm text-muted-foreground">
              Count distinct cities per author, order by cities then tweets, take the first ten, and
              spell out the per-city counts, for example <Code>#1879gmel</Code>.
            </p>
          </Panel>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="fidelity">
        <SectionHeading id="fidelity" eyebrow="Fidelity" title="Ported, not reinvented">
          <p>
            The browser runs a line-for-line TypeScript port of the 2023 code, magic numbers and
            quirks included. The original Python in coursework/ (analysis logic as submitted) was
            run outside Spartan (with mpi4py stubbed and the ranks re-enacted in order) to produce
            reference outputs, and the test suite checks the port against them:
          </p>
        </SectionHeading>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Panel
            as="div"
            title="In the test suite (runs in CI)"
            description="Fixtures produced by the original Python"
          >
            <ul className="space-y-2 text-sm">
              {[
                "per-tweet records (id, author, normalised place, gcc) identical",
                "per-rank tweet counts identical for 1, 3, 4 and 7 ranks",
                "task1.csv, task2.csv, task3.csv and task3_1.csv identical",
                "process_salV1 on a sal.json sample: same keys, codes and insertion order",
                "every demo place resolves exactly as it does against the full sal.json",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            as="div"
            title="Checked locally with the course files"
            description="Not committed: course data stays off GitHub"
          >
            <ul className="space-y-2 text-sm">
              {[
                `the full processed sal_dict: all ${formatInt(gazetteer.source.fullDictionaryKeys)} keys and codes identical`,
                "tinyTwitter.json: records, per-rank counts and all four CSVs identical for 1, 3, 4 and 8 ranks",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-signal"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/lab">
              Run it in the MPI lab <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/results">See the 2023 results</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
