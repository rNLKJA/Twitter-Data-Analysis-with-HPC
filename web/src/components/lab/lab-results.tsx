"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TaskResults } from "@/lib/lab/runs";
import { formatInt, formatPct } from "@/lib/format";
import { gccInfo, gccLabel } from "@/lib/gcc";

export function LabResults({ results, size }: { results: TaskResults | undefined; size: number }) {
  if (!results) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        The three answers appear here once a run finishes.
      </p>
    );
  }
  const t2Max = Math.max(1, ...results.task2.map((r) => r.tweets));
  const t2Total = results.task2.reduce((s, r) => s + r.tweets, 0);
  const host = (t: number) => (size === 1 ? 0 : t - 1);

  return (
    <Tabs defaultValue="t2">
      <TabsList aria-label="Task results" className="w-full sm:w-fit">
        <TabsTrigger value="t1">Task 1</TabsTrigger>
        <TabsTrigger value="t2">Task 2</TabsTrigger>
        <TabsTrigger value="t3">Task 3</TabsTrigger>
      </TabsList>

      <TabsContent value="t1" className="pt-2">
        <p className="mb-2 text-xs text-muted-foreground">
          Top tweeters, reduced on rank {host(1)} (ties share a rank).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[0.65rem] tracking-[0.1em] text-muted-foreground uppercase">
              <th scope="col" className="pb-1.5 font-medium">
                Rank
              </th>
              <th scope="col" className="pb-1.5 font-medium">
                Author id
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                Tweets
              </th>
            </tr>
          </thead>
          <tbody>
            {results.task1.map((r) => (
              <tr key={r.authorId} className="border-t border-border/60">
                <td className="num py-1.5 font-mono text-muted-foreground">#{r.rank}</td>
                <td className="py-1.5 font-mono text-xs break-all">{r.authorId}</td>
                <td className="num py-1.5 text-right font-mono">{formatInt(r.tweets)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="t2" className="pt-2">
        <p className="mb-2 text-xs text-muted-foreground">
          Tweets per Greater Capital City, reduced on rank {host(2)}.
        </p>
        {results.task2.length === 0 && <NoCityTweets />}
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">Greater Capital City</th>
              <th scope="col">Share</th>
              <th scope="col">Tweets</th>
            </tr>
          </thead>
          <tbody>
            {[...results.task2]
              .sort((a, b) => b.tweets - a.tweets)
              .map((r) => (
                <tr key={r.gcc}>
                  <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">
                    {gccInfo(r.gcc)?.city ?? gccLabel(r.gcc)}
                    <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">
                      {r.gcc}
                    </span>
                  </th>
                  <td className="w-full py-1 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1" aria-hidden>
                        <div
                          className="h-full rounded-r-[4px] bg-series-1"
                          style={{ width: `${(r.tweets / t2Max) * 100}%` }}
                        />
                      </div>
                      <span className="w-11 text-right font-mono text-[0.7rem] text-muted-foreground">
                        {formatPct(r.tweets / t2Total)}
                      </span>
                    </div>
                  </td>
                  <td className="num py-1 text-right font-mono">{formatInt(r.tweets)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="t3" className="pt-2">
        <p className="mb-2 text-xs text-muted-foreground">
          Authors in the most capital cities, reduced on rank {host(3)}, in the original task3.csv
          format.
        </p>
        {results.task3.rows.length === 0 && <NoCityTweets crash />}
        <ol className="space-y-1.5">
          {results.task3.rows.map((r) => (
            <li
              key={r.authorId}
              className="grid grid-cols-[1.75rem_1fr] gap-x-2 border-t border-border/60 pt-1.5 text-sm"
            >
              <span className="num font-mono text-muted-foreground">#{r.rank}</span>
              <span className="min-w-0">
                <span className="font-mono text-xs">{r.authorId}</span>
                <span className="block font-mono text-[0.7rem] break-words text-muted-foreground">
                  {r.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </TabsContent>
    </Tabs>
  );
}

/** No tweet resolved to a capital city (e.g. an upload with foreign places only). */
function NoCityTweets({ crash = false }: { crash?: boolean }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      No tweet in this file resolved to a Greater Capital City, so there is nothing to count here.
      {crash && (
        <>
          {" "}
          The 2023 code does not survive this case: after writing task3_1.csv it stops with a polars
          ComputeError (the empty per-author table&apos;s join key has the wrong type), so task3.csv
          is never written. The port shows the empty result instead.
        </>
      )}
    </p>
  );
}
