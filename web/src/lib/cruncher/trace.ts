import {
  AUTHOR_ID,
  LOCATION_ID,
  SKIP_AFTER_ID,
  SKIP_LINES_1,
  SKIP_LINES_2,
  TWEETS_ID,
} from "./constants";
import { resolveLocation, type SalDict } from "./normalise";
import { toInt64String } from "./processor";

/**
 * Line-by-line trace of what `twitterProcessorV1` does with the start of a
 * file, for the "How it works" explainer. It follows exactly the same rules as
 * the ported scanner (all three regexes tested on every *read* line, then
 * 2 / 18 / 20 lines skipped after an `_id` / `author_id` / `full_name` hit),
 * but keeps the text of skipped lines so they can be shown greyed out.
 * `trace.test.ts` checks that it extracts the same records as the scanner.
 */

export type TraceHit =
  | { kind: "id"; value: string; skip: number }
  | { kind: "author"; value: string; skip: number }
  | {
      kind: "location";
      value: string;
      normalised: string;
      gcc: string | null;
      matchedBy: string | null;
      skip: number;
    };

export interface TraceLine {
  /** 1-based line number in the file. */
  n: number;
  text: string;
  /** `read` = regex-tested by the scanner; `skip` = consumed by a skip count. */
  mode: "read" | "skip";
  hits: TraceHit[];
  /** Index of the tweet this line belongs to (by the scanner's own counting). */
  tweet: number;
}

export interface TraceRecord {
  tweetId: string;
  authorId: string;
  location: string;
  gcc: string | null;
}

export interface TraceResult {
  lines: TraceLine[];
  records: TraceRecord[];
  readCount: number;
  skipCount: number;
}

/** Trace the scanner from byte 0 until `maxTweets` tweets are complete. */
export function traceScanner(text: string, salDict: SalDict, maxTweets = 1): TraceResult {
  const raw = text.split("\n");
  const lines: TraceLine[] = [];
  const ids: string[] = [];
  const authors: string[] = [];
  const locations: string[] = [];
  const gccs: Array<string | null> = [];
  let readCount = 0;
  let skipCount = 0;
  let i = 0;

  const skip = (count: number) => {
    for (let k = 0; k < count && i < raw.length; k++, i++) {
      lines.push({
        n: i + 1,
        text: raw[i],
        mode: "skip",
        hits: [],
        tweet: Math.max(0, ids.length - 1),
      });
      skipCount++;
    }
  };

  while (i < raw.length) {
    const lineText = raw[i];
    const entry: TraceLine = { n: i + 1, text: lineText, mode: "read", hits: [], tweet: 0 };
    lines.push(entry);
    readCount++;
    i++;

    const matchId = TWEETS_ID.exec(lineText);
    const matchLocation = LOCATION_ID.exec(lineText);
    const matchAuthor = AUTHOR_ID.exec(lineText);

    if (matchId) {
      ids.push(matchId[1]);
      entry.hits.push({ kind: "id", value: matchId[1], skip: SKIP_AFTER_ID });
    }
    entry.tweet = Math.max(0, ids.length - 1);
    if (matchId) skip(SKIP_AFTER_ID);

    if (matchAuthor && ids.length !== authors.length) {
      const value = toInt64String(matchAuthor[1]);
      authors.push(value);
      entry.hits.push({ kind: "author", value, skip: SKIP_LINES_1 });
      skip(SKIP_LINES_1);
    }

    if (matchLocation && ids.length !== gccs.length) {
      const r = resolveLocation(matchLocation[1], salDict);
      locations.push(r.location);
      gccs.push(r.gcc);
      entry.hits.push({
        kind: "location",
        value: matchLocation[1],
        normalised: r.location,
        gcc: r.gcc,
        matchedBy: r.matchedBy,
        skip: SKIP_LINES_2,
      });
      skip(SKIP_LINES_2);
      if (gccs.length >= maxTweets && ids.length === gccs.length) break;
    }
  }

  const records = ids.slice(0, gccs.length).map((tweetId, k) => ({
    tweetId,
    authorId: authors[k],
    location: locations[k],
    gcc: gccs[k],
  }));
  return { lines, records, readCount, skipCount };
}
