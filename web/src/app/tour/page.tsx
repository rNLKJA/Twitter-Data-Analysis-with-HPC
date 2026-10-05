import { ArrowRight, Clapperboard, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, SectionHeading } from "@/components/common/page-header";
import { LazyVideo } from "@/components/tour/lazy-video";
import { ScreenshotGallery } from "@/components/tour/screenshot-gallery";
import { Button } from "@/components/ui/button";
import {
  MOCK_ANSWER_PREFIX,
  MOCK_LABEL,
  SCREENSHOTS,
  WALKTHROUGHS,
  type Walkthrough,
  walkthroughMedia,
} from "@/lib/showcase";
import { sourceUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Guided tour",
  description:
    "Three short captioned walkthroughs (the original results, the scaling lab, and MPI running in your browser with the optional AI feature) and screenshots of every key feature, recorded by a reproducible Playwright script.",
};

export default function TourPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="Guided tour" title="The project in three short walkthroughs">
        <p>
          Each video follows one workflow from start to finish, with the step shown on screen and as
          captions. A Playwright script recorded them from this site and checked every step on the
          way (the published numbers, the fitted serial fraction, the 8-rank run matching the 1-rank
          baseline), so the same seeds reproduce the same inputs. Timings are measured live and
          differ from machine to machine.
        </p>
        <nav
          aria-label="Walkthroughs"
          className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm sm:text-base"
        >
          {WALKTHROUGHS.map((w, i) => (
            <a key={w.id} href={`#${w.id}`} className="link">
              {i + 1}. {w.title}
            </a>
          ))}
          <a href="#screenshots" className="link">
            Screenshots
          </a>
        </nav>
      </PageHeader>

      <div className="space-y-20">
        {WALKTHROUGHS.map((w, i) => (
          <WalkthroughSection key={w.id} walkthrough={w} index={i} />
        ))}

        <section className="space-y-6" aria-labelledby="screenshots">
          <SectionHeading
            id="screenshots"
            eyebrow="Screenshots"
            title="Every key feature at a glance"
          >
            <p>
              Captured by the same script, in light mode at 1440 × 900 (the landing page also in
              dark mode) and on a 390 px phone. Select one to enlarge it; the arrow keys step
              through the set.
            </p>
          </SectionHeading>
          <ScreenshotGallery items={SCREENSHOTS} />
        </section>

        <section
          aria-labelledby="how-made"
          className="panel grid gap-4 p-5 sm:p-6 md:grid-cols-[auto_1fr]"
        >
          <Clapperboard className="size-6 text-primary" aria-hidden />
          <div className="space-y-2">
            <h2 id="how-made" className="font-heading text-lg font-semibold tracking-tight">
              How these were made
            </h2>
            <p className="text-sm text-muted-foreground">
              <code className="font-mono">pnpm showcase</code> runs{" "}
              <a
                href={sourceUrl("web/e2e/showcase.spec.ts")}
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                web/e2e/showcase.spec.ts
              </a>{" "}
              on the system Chrome: it plays each journey at a human pace with an on-screen caption
              and cursor, asserts what it shows, and records it at 1280 × 800. ffmpeg then encodes
              the H.264 videos here and the GIFs in the README. The captions and the step lists on
              this page are the same text as the on-screen steps.
            </p>
            <p className="text-sm text-muted-foreground">
              No real API key is used anywhere in these recordings. Where the AI feature appears,
              the key is a placeholder, every request to the provider is intercepted in the browser,
              and the reply is a labelled mock whose text starts with &ldquo;{MOCK_ANSWER_PREFIX}
              &rdquo;.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** "Steps 6 to 10" for a run of consecutive steps, otherwise "Steps 2, 5 and 7". */
function stepRange(steps: readonly number[]) {
  const sorted = [...steps].sort((a, b) => a - b);
  const consecutive = sorted.every((s, i) => i === 0 || s === sorted[i - 1] + 1);
  if (sorted.length > 2 && consecutive) return `Steps ${sorted[0]} to ${sorted.at(-1)}`;
  if (sorted.length === 1) return `Step ${sorted[0]}`;
  return `Steps ${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

function WalkthroughSection({
  walkthrough: w,
  index,
}: {
  walkthrough: Walkthrough;
  index: number;
}) {
  const media = walkthroughMedia(w.id);
  const mocked = new Set(w.mockedSteps ?? []);
  const stepsId = `${w.id}-steps`;
  return (
    <section className="scroll-mt-20 space-y-6" aria-labelledby={w.id}>
      <SectionHeading
        id={w.id}
        eyebrow={`Walkthrough ${index + 1} of ${WALKTHROUGHS.length} · ${w.route}`}
        title={w.title}
      >
        <p>{w.summary}</p>
      </SectionHeading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <figure className="min-w-0 space-y-3">
          <LazyVideo
            src={media.mp4}
            poster={media.poster}
            captions={media.captions}
            label={`${w.title}: a ${w.steps.length}-step walkthrough with captions`}
            width={1280}
            height={800}
          />
          <figcaption className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-foreground">Setup:</span> {w.setup}
            </span>
            <a href={media.mp4} className="link">
              Open the MP4
            </a>
          </figcaption>
          {mocked.size > 0 && (
            <p className="flex gap-2.5 rounded-lg border border-dashed border-caution/60 bg-caution/10 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-caution" aria-hidden />
              <span>
                <strong>{MOCK_LABEL}.</strong> {stepRange([...mocked])} use a placeholder key.
                Requests to the provider are intercepted in the browser and answered by a mock, so
                no model was called: the answer shows how the feature labels, cites, checks and logs
                a reply, not what a real model would say.
              </span>
            </p>
          )}
        </figure>

        <div className="space-y-4">
          <h3 id={stepsId} className="font-heading font-semibold">
            Steps <span className="font-normal text-muted-foreground">(transcript)</span>
          </h3>
          <ol aria-labelledby={stepsId} className="space-y-2">
            {w.steps.map((step, k) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary/12 px-1 font-mono text-xs font-semibold text-primary tabular-nums">
                  {k + 1}
                </span>
                <span className="pt-0.5">
                  {step}
                  {mocked.has(k + 1) && (
                    <span className="block text-xs text-muted-foreground">{MOCK_LABEL}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline">
            <Link href={w.route}>
              Try it yourself <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
