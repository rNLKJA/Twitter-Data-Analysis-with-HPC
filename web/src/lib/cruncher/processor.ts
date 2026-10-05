import type { ByteFile } from "./byte-file";
import {
  AUTHOR_ID,
  LOCATION_ID,
  SKIP_AFTER_ID,
  SKIP_LINES_1,
  SKIP_LINES_2,
  TWEETS_ID,
} from "./constants";
import { decodeLine } from "./decode";
import { normaliseLocation, wordNgrams, type SalDict } from "./normalise";

/** Column-oriented equivalent of the polars frame returned by the original. */
export interface TweetFrame {
  tweetId: string[];
  /** Canonical decimal strings (the original stores `np.int64`). */
  authorId: string[];
  location: string[];
  gcc: Array<string | null>;
}

export interface ProcessorProgress {
  /** Bytes consumed so far, relative to the chunk start. */
  bytesRead: number;
  /** Size of the assigned byte range (ce - cs). */
  chunkBytes: number;
  tweets: number;
  linesRead: number;
  linesSkipped: number;
}

export interface ProcessorOptions {
  onProgress?: (p: ProcessorProgress) => void;
  /** Emit progress roughly every N lines (default 50k). */
  progressEvery?: number;
}

export interface ProcessorStats {
  linesRead: number;
  linesSkipped: number;
  /** Where the rank actually stopped reading (>= ce, to finish its last tweet). */
  stoppedAt: number;
}

export class UnbalancedChunkError extends Error {
  constructor(rank: string) {
    super(
      `Reached EOF with an unfinished tweet (${rank}). The original loop would spin forever here; ` +
        "the input does not follow the bigTwitter.json line layout.",
    );
    this.name = "UnbalancedChunkError";
  }
}

/** `np.int64(text)` → canonical decimal string (strips leading zeros, validates). */
export function toInt64String(text: string): string {
  return BigInt(text.trim()).toString();
}

/**
 * Port of `twitter_processor.twitter_processorV1` — the line scanner each MPI
 * rank ran over its byte range [cs, ce):
 *
 * - every line is regex-searched for `"_id"`, `"full_name"` and `"author_id"`;
 * - after an `_id` hit the next 2 lines are skipped, after `author_id` 18 lines,
 *   after `full_name` 20 lines (the "magic numbers" tuned to bigTwitter.json);
 * - the location is normalised and its word n-grams looked up in sal_dict;
 * - the rank keeps reading past `ce` until its last tweet has a location, and
 *   a rank that starts mid-tweet ignores that partial tweet, so every tweet is
 *   counted by exactly one rank.
 */
export function twitterProcessorV1(
  file: ByteFile,
  cs: number,
  ce: number,
  salDict: SalDict,
  options: ProcessorOptions = {},
): { frame: TweetFrame; stats: ProcessorStats } {
  const tweetsId: string[] = [];
  const authorId: string[] = [];
  const gcc: Array<string | null> = [];
  const locations: string[] = [];

  const progressEvery = options.progressEvery ?? 50_000;
  let linesRead = 0;
  let linesSkipped = 0;
  let nextProgress = progressEvery;

  const skip = (n: number) => {
    for (let i = 0; i < n; i++) file.skipline();
    linesSkipped += n;
  };

  file.seek(cs);

  for (;;) {
    const raw = file.readline();
    linesRead++;
    if (raw.length === 0 && file.tell() >= file.size && tweetsId.length !== gcc.length) {
      throw new UnbalancedChunkError(`chunk ${cs}-${ce}`);
    }
    const line = decodeLine(raw);

    const matchId = TWEETS_ID.exec(line);
    const matchLocation = LOCATION_ID.exec(line);
    const matchAuthor = AUTHOR_ID.exec(line);

    if (matchId) {
      tweetsId.push(matchId[1]);
      skip(SKIP_AFTER_ID);
    }

    if (matchAuthor && tweetsId.length !== authorId.length) {
      authorId.push(toInt64String(matchAuthor[1]));
      skip(SKIP_LINES_1);
    }

    if (matchLocation && tweetsId.length !== gcc.length) {
      const location = normaliseLocation(matchLocation[1].toLowerCase());
      locations.push(location);

      for (const possibleLocation of wordNgrams(location.split(" "))) {
        const hit = salDict.get(possibleLocation);
        if (hit) {
          gcc.push(hit);
          break;
        }
      }
      if (tweetsId.length !== gcc.length) gcc.push(null);

      skip(SKIP_LINES_2);
    }

    if (options.onProgress && linesRead + linesSkipped >= nextProgress) {
      nextProgress = linesRead + linesSkipped + progressEvery;
      options.onProgress({
        bytesRead: Math.min(file.tell(), ce) - cs,
        chunkBytes: ce - cs,
        tweets: tweetsId.length,
        linesRead,
        linesSkipped,
      });
    }

    // break condition check
    if (file.tell() >= ce && tweetsId.length === gcc.length) break;
  }

  // pl.DataFrame({...}) raises a ShapeError on ragged columns.
  if (
    tweetsId.length !== authorId.length ||
    tweetsId.length !== locations.length ||
    tweetsId.length !== gcc.length
  ) {
    throw new Error(
      `ShapeError: column lengths differ (tweet_id=${tweetsId.length}, author_id=${authorId.length}, ` +
        `location=${locations.length}, gcc=${gcc.length})`,
    );
  }

  options.onProgress?.({
    bytesRead: ce - cs,
    chunkBytes: ce - cs,
    tweets: tweetsId.length,
    linesRead,
    linesSkipped,
  });

  return {
    frame: { tweetId: tweetsId, authorId, location: locations, gcc },
    stats: { linesRead, linesSkipped, stoppedAt: file.tell() },
  };
}
