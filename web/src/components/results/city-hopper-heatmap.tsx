import type { CSSProperties } from "react";

import { TASK3, parseTask3Text } from "@/lib/data/original";
import { formatInt, formatPct } from "@/lib/format";
import { GCC_LIST } from "@/lib/gcc";
import { cn } from "@/lib/utils";

const CITIES = GCC_LIST.filter((g) => g.code !== "9oter");

/**
 * Task 3 as a heatmap table: rows are the top-10 authors, columns the eight
 * capital cities; each cell shows the tweet count and is shaded (one hue,
 * light → dark) by that city's share of the author's tweets.
 */
export function CityHopperHeatmap() {
  const rows = TASK3.map((r) => ({ ...r, parsed: parseTask3Text(r.text) }));

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">
        Swipe the table sideways to see all eight cities.
      </p>
      <div
        className="-mx-1 overflow-x-auto px-1 pb-1"
        tabIndex={0}
        aria-label="Task 3 heatmap, scrollable"
      >
        <table className="w-full min-w-[640px] border-separate border-spacing-[2px] text-sm">
          <caption className="sr-only">
            Top 10 authors by number of distinct Greater Capital Cities tweeted from, with tweets
            per city
          </caption>
          <thead>
            <tr className="font-mono text-[0.68rem] tracking-[0.1em] text-muted-foreground uppercase">
              <th scope="col" className="pb-2 text-left font-medium">
                #
              </th>
              <th scope="col" className="pb-2 text-left font-medium">
                Author id
              </th>
              {CITIES.map((c) => (
                <th
                  key={c.code}
                  scope="col"
                  className="pb-2 text-center font-medium"
                  title={c.name}
                >
                  <abbr title={c.name} className="no-underline">
                    {c.short.slice(1).toUpperCase()}
                  </abbr>
                </th>
              ))}
              <th scope="col" className="pb-2 pl-2 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const counts = new Map(r.parsed.breakdown.map((b) => [b.gcc, b.tweets]));
              return (
                <tr key={r.rank}>
                  <td className="num pr-2 font-mono text-muted-foreground">{r.rank}</td>
                  <th
                    scope="row"
                    className="pr-2 text-left font-mono text-[0.78rem] font-normal whitespace-nowrap"
                  >
                    {r.authorId}
                  </th>
                  {CITIES.map((c) => {
                    const n = counts.get(c.code) ?? 0;
                    const share = n / r.parsed.tweets;
                    // sqrt spreads the long tail; the ramp itself lives in CSS (.heat-cell) so
                    // light and dark mode can use different spans and text colours
                    const s = Math.sqrt(share);
                    return (
                      <td
                        key={c.code}
                        className={cn(
                          "num h-9 min-w-12 rounded-[4px] text-center font-mono text-[0.78rem]",
                          n > 0 && "heat-cell",
                          n > 0 && 6 + 94 * s >= 70 && "dark:text-[var(--on-series-1)]",
                        )}
                        style={{ "--s": s.toFixed(3) } as CSSProperties}
                        title={`${c.name}: ${formatInt(n)} of ${formatInt(r.parsed.tweets)} tweets (${formatPct(share)})`}
                      >
                        {n === 0 ? <span className="text-muted-foreground">0</span> : formatInt(n)}
                      </td>
                    );
                  })}
                  <td className="num pl-2 text-right font-mono">{formatInt(r.parsed.tweets)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span>Share of the author&apos;s tweets</span>
          <span aria-hidden className="heat-legend inline-block h-2.5 w-28 rounded-full border" />
          <span className="font-mono">0 → 100%</span>
        </span>
        <span>
          Columns: {CITIES.map((c) => `${c.short.slice(1).toUpperCase()} ${c.city}`).join(" · ")}
        </span>
      </div>
    </div>
  );
}
