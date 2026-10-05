import type { Metadata } from "next";
import Link from "next/link";

import { Metric, PageHeader, Panel, SectionHeading } from "@/components/common/page-header";
import { CityHopperHeatmap } from "@/components/results/city-hopper-heatmap";
import { GccDashboard, type CityDatum } from "@/components/results/gcc-dashboard";
import { RawOutput } from "@/components/results/raw-output";
import { TopTweeters } from "@/components/results/top-tweeters";
import { DATASET, TASK1, TASK2, TASK2_TOTAL, TASK3, parseTask3Text } from "@/lib/data/original";
import { formatBytes, formatCompact, formatInt, formatPct } from "@/lib/format";
import { gccInfo } from "@/lib/gcc";
import { australiaMap } from "@/lib/geo/australia";

export const metadata: Metadata = {
  title: "Results",
  description:
    "The three answers from the 2023 Spartan run over bigTwitter.json: top tweeters, tweets per Greater Capital City, and the authors who tweeted from the most capital cities.",
};

export default function ResultsPage() {
  const map = australiaMap(800, 680);
  const cities: CityDatum[] = TASK2.map((r) => {
    const info = gccInfo(r.gcc)!;
    const onMap = r.gcc !== "9oter";
    const [x, y] = onMap ? map.project(info.lon, info.lat) : [null, null];
    return {
      code: r.gcc,
      name: info.name,
      city: info.city,
      state: info.state,
      tweets: r.tweets,
      x,
      y,
    };
  });
  const melb = TASK2.find((r) => r.gcc === "2gmel")!.tweets;
  const syd = TASK2.find((r) => r.gcc === "1gsyd")!.tweets;
  const days = (Date.parse(DATASET.lastDay) - Date.parse(DATASET.firstDay)) / 86_400_000 + 1;
  const leader = parseTask3Text(TASK3[0].text);
  const leaderTop = leader.breakdown[0];
  const leaderCity = gccInfo(leaderTop.gcc)?.city ?? leaderTop.gcc;
  // the author whose busiest city holds the smallest share of their tweets
  const evenRank = TASK3.map((r) => {
    const p = parseTask3Text(r.text);
    return { rank: r.rank, top: p.breakdown[0].tweets / p.tweets };
  }).sort((a, b) => a.top - b.top)[0].rank;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader
        eyebrow="Results · bigTwitter.json · final Spartan run"
        title="What 9 million tweets said about where Australia tweets from"
      >
        <p>
          The assignment asked three questions of a {formatBytes(DATASET.bytes)} file of geotagged
          tweets. These are the answers our MPI program wrote to{" "}
          <code className="font-mono text-[0.9em]">data/result/</code> on Spartan in April 2023,
          transcribed exactly. The raw tweets were course data and are not reproduced here.
        </p>
      </PageHeader>

      <dl className="panel grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Metric
          label="Tweets"
          value={formatCompact(DATASET.tweets)}
          hint={formatInt(DATASET.tweets)}
        />
        <Metric
          label="Authors"
          value={formatCompact(DATASET.authors)}
          hint={formatInt(DATASET.authors)}
        />
        <Metric
          label="Window"
          value="18 months"
          hint={`${DATASET.firstDay} → ${DATASET.lastDay}`}
        />
        <Metric
          label="In a capital city"
          value={formatPct(TASK2_TOTAL / DATASET.tweets)}
          hint={`${formatInt(TASK2_TOTAL)} tweets`}
          tone="primary"
        />
      </dl>

      <section className="mt-16 space-y-6" aria-labelledby="task2">
        <SectionHeading
          id="task2"
          eyebrow="Task 2 · tweets per Greater Capital City"
          title="Melbourne edges out Sydney"
        >
          <p>
            Each tweet&apos;s place name was normalised and matched against the suburb gazetteer (
            <code className="font-mono text-[0.9em]">sal.json</code>) to find its Greater Capital
            City Statistical Area. Melbourne logged {formatInt(melb - syd)} more tweets than Sydney,
            and together the two account for {formatPct((melb + syd) / TASK2_TOTAL)} of all
            capital-city tweets.
          </p>
        </SectionHeading>
        <GccDashboard
          width={map.width}
          height={map.height}
          outline={map.outline}
          cities={cities}
          total={DATASET.tweets}
        />
      </section>

      <section
        className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
        aria-labelledby="task1"
      >
        <SectionHeading
          id="task1"
          eyebrow="Task 1 · most prolific authors"
          title={`One account out-tweeted the next by ${(TASK1[0].tweets / TASK1[1].tweets).toFixed(1)} times`}
        >
          <p>
            Tweets were counted per <code className="font-mono text-[0.9em]">author_id</code> on
            every rank, summed on rank 0 and ranked with ties sharing the best place. The top
            account posted {formatInt(TASK1[0].tweets)} tweets in 18 months, about{" "}
            {Math.round(TASK1[0].tweets / days)} a day.
          </p>
          <p className="mt-3">
            Want to see the same reduction happen?{" "}
            <Link href="/lab" className="link">
              Run it in the MPI lab
            </Link>
            .
          </p>
        </SectionHeading>
        <Panel title="Top 10 tweeters" description="task1.csv, all of bigTwitter.json">
          <TopTweeters />
        </Panel>
      </section>

      <section className="mt-16 space-y-6" aria-labelledby="task3">
        <SectionHeading
          id="task3"
          eyebrow="Task 3 · authors across the most capital cities"
          title={`${TASK3.length} authors tweeted from all eight capital cities`}
        >
          <p>
            Authors were ranked by how many distinct capital cities they tweeted from, with ties
            broken by total tweets. Every top-10 author reached all eight, but in very different
            ways: the leader sent {formatPct(leaderTop.tweets / leader.tweets, 0)} of their tweets
            from {leaderCity}, while #{evenRank} spread theirs almost evenly across the country.
          </p>
        </SectionHeading>
        <Panel
          title="Tweets per city for the top 10 city-hoppers"
          description="Parsed from task3.csv; hover a cell for its share"
        >
          <CityHopperHeatmap />
        </Panel>
      </section>

      <section
        className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        aria-labelledby="raw"
      >
        <SectionHeading id="raw" eyebrow="Raw output" title="Exactly what main.py wrote">
          <p>
            Rank 0 wrote Task 1, rank 1 wrote Task 2 and rank 2 wrote Task 3, each as a CSV. The
            header typo (&ldquo;Captical&rdquo;) is the original&apos;s and is preserved, because
            the browser port reproduces these files byte for byte.
          </p>
        </SectionHeading>
        <Panel>
          <RawOutput />
        </Panel>
      </section>
    </div>
  );
}
