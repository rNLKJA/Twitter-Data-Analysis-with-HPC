import { TASK1, TASK1_ID_NOTE } from "@/lib/data/original";
import { formatInt } from "@/lib/format";

/** Task 1: the ten most prolific authors, as a table with inline bars. */
export function TopTweeters() {
  const max = TASK1[0].tweets;
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Top 10 authors by number of tweets in bigTwitter.json</caption>
        <thead>
          <tr className="text-left font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <th scope="col" className="pb-2 font-medium">
              Rank
            </th>
            <th scope="col" className="pb-2 font-medium">
              Author id
            </th>
            <th scope="col" className="hidden w-[40%] pb-2 font-medium sm:table-cell">
              <span className="sr-only">Relative volume</span>
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Tweets
            </th>
          </tr>
        </thead>
        <tbody>
          {TASK1.map((r) => (
            <tr key={r.rank} className="border-t border-border/60">
              <td className="num py-2 pr-3 font-mono text-muted-foreground">#{r.rank}</td>
              <td className="py-2 pr-3 font-mono text-[0.8rem] break-all">{r.authorId}</td>
              <td className="hidden py-2 pr-4 sm:table-cell" aria-hidden>
                <div className="h-2.5 w-full">
                  <div
                    className="h-full rounded-r-[4px] bg-series-1"
                    style={{ width: `${(r.tweets / max) * 100}%` }}
                  />
                </div>
              </td>
              <td className="num py-2 text-right font-mono">{formatInt(r.tweets)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">{TASK1_ID_NOTE}</p>
    </div>
  );
}
