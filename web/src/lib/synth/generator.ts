import placesFile from "./places.json";
import { createRng, weightedSampler, type Rng } from "./prng";

/**
 * Seeded generator for a synthetic `bigTwitter.json`-shaped file.
 *
 * The original scanner does not parse JSON: it reads lines and skips a fixed
 * number of them after each hit (2 / 18 / 20). So the synthetic file copies
 * the *line layout* of the course data exactly — a pretty-printed JSON array
 * (2-space indent) of CouchDB documents with `_id`, `_rev`, `data`
 * (`author_id` first, `sentiment` last), `includes.places[0].full_name` and
 * `matching_rules`. Every tweet keeps at least 18 lines between `author_id`
 * and `full_name` and exactly 20 lines after `full_name`, which is what the
 * magic numbers assume. Tweet text is ASCII and entirely made up.
 */

export interface Place {
  name: string;
  w: number;
  lat: number;
  lon: number;
}

export const PLACES: readonly Place[] = (placesFile as { places: Place[] }).places;

export interface SynthOptions {
  seed: number;
  tweets: number;
  /** Override the default author pool size (≈ tweets / 24). */
  authors?: number;
}

export interface SynthAuthor {
  id: string;
  weight: number;
  home: number;
  traveller: boolean;
  visits: number[];
}

/** Twitter's snowflake epoch (2010-11-04T01:42:54.657Z). */
const TWITTER_EPOCH = 1288834974657n;
const START_MS = Date.UTC(2021, 6, 5, 0, 0, 0); // 2021-07-05, first day in bigTwitter.json
const END_MS = Date.UTC(2022, 11, 31, 23, 59, 59); // 2022-12-31

const CAPITAL_NAMES = [
  "Sydney, New South Wales",
  "Melbourne, Victoria",
  "Brisbane, Queensland",
  "Adelaide, South Australia",
  "Perth, Western Australia",
  "Hobart, Tasmania",
  "Darwin, Northern Territory",
  "Canberra, Australian Capital Territory",
];

const RULE_ID = 1412189062442586000;
const RULE_TAG = "synthetic: geotagged tweets from Australia";

const OPENERS = [
  "Finally made it to",
  "Morning walk around",
  "Cannot believe the weather in",
  "Coffee recommendations near",
  "Late train again in",
  "Sunset over",
  "Weekend market in",
  "Back home in",
  "Team lunch in",
  "Quiet night in",
  "Footy tonight in",
  "Road trip stop at",
];
const ENDINGS = [
  "and it is lovely.",
  "- who else is around?",
  "again. Classic.",
  "with the crew.",
  "before the rain hits.",
  "and the queue is huge.",
  "for the first time in ages.",
  "- highly recommend.",
];
const HASHTAGS = [
  "data",
  "hpc",
  "mpi",
  "weekend",
  "coffee",
  "footy",
  "sunset",
  "travel",
  "work",
  "uni",
];
const HANDLES = [
  "spartan_hpc",
  "cloudlab",
  "melb_eats",
  "syd_trains",
  "data_nerd",
  "ccc_tutor",
  "maps_au",
];
const SHORT_LINK = "https://t.co/";

function snowflake(ms: number, rng: Rng): string {
  const t = BigInt(Math.floor(ms)) - TWITTER_EPOCH;
  const low = BigInt(rng.int(0, (1 << 22) - 1));
  return ((t << 22n) | low).toString();
}

function placeId(index: number): string {
  // stable 16-hex id per vocabulary entry
  let h = 0x811c9dc5 ^ index;
  let out = "";
  for (let i = 0; i < 16; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    out += (h & 15).toString(16);
  }
  return out;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** Deterministic author pool: Zipf-like activity, home places, a few travellers. */
export function makeAuthors(rng: Rng, count: number): SynthAuthor[] {
  const placeOf = weightedSampler(PLACES.map((p) => p.w));
  // Capital-city entries (one per GCC) that travellers hop between.
  const capitals = CAPITAL_NAMES.map((n) => PLACES.findIndex((p) => p.name === n)).filter(
    (i) => i >= 0,
  );
  const seen = new Set<string>();
  const authors: SynthAuthor[] = [];
  for (let i = 0; i < count; i++) {
    let id: string;
    do {
      if (rng.chance(0.45)) {
        id = String(rng.int(10_000_000, 3_999_999_999));
      } else {
        const created =
          Date.UTC(2012, 0, 1) + rng.next() * (Date.UTC(2022, 0, 1) - Date.UTC(2012, 0, 1));
        id = snowflake(created, rng);
      }
    } while (seen.has(id));
    seen.add(id);

    const traveller = rng.chance(0.05);
    const visits: number[] = [];
    if (traveller) {
      const stops = rng.int(3, capitals.length);
      const pool = [...capitals];
      for (let k = 0; k < stops && pool.length; k++) {
        visits.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
      }
    }
    authors.push({
      id,
      weight: 1 / Math.pow(i + 1, 0.85),
      home: placeOf(rng.next()),
      traveller,
      visits,
    });
  }
  return authors;
}

interface TweetDoc {
  _id: string;
  _rev: string;
  data: Record<string, unknown>;
  includes: { places: Array<Record<string, unknown>> };
  matching_rules: Array<{ id: number; tag: string }>;
}

function buildTweet(rng: Rng, ms: number, author: SynthAuthor, placeIndex: number): TweetDoc {
  const place = PLACES[placeIndex];
  const id = snowflake(ms, rng);
  const city = place.name.split(",")[0];

  let text = `${rng.pick(OPENERS)} ${city} ${rng.pick(ENDINGS)}`;
  const entities: Record<string, unknown> = {};
  if (rng.chance(0.25)) {
    const tag = rng.pick(HASHTAGS);
    const start = text.length + 1;
    text += ` #${tag}`;
    entities.hashtags = [{ start, end: start + tag.length + 1, tag }];
  }
  if (rng.chance(0.2)) {
    const handle = rng.pick(HANDLES);
    const start = text.length + 1;
    text += ` @${handle}`;
    entities.mentions = [
      { start, end: start + handle.length + 1, username: handle, id: rng.digits(rng.int(8, 10)) },
    ];
  }
  if (rng.chance(0.12)) {
    const short = `${SHORT_LINK}${rng.hex(10)}`;
    const start = text.length + 1;
    text += ` ${short}`;
    entities.urls = [
      {
        start,
        end: start + short.length,
        url: short,
        expanded_url: `https://twitter.com/i/web/status/${id}`,
        display_url: `twitter.com/i/web/status/${id.slice(0, 6)}...`,
      },
    ];
  }
  const hasEntities = Object.keys(entities).length > 0;
  // `sentiment` is the last data field; without entities it is required so
  // that author_id → full_name spans the 18 lines SKIP_LINES_1 expects.
  const withSentiment = !hasEntities || rng.chance(0.85);

  const pid = placeId(placeIndex);
  const data: Record<string, unknown> = {
    author_id: author.id,
    conversation_id: id,
    created_at: new Date(ms).toISOString(),
  };
  if (hasEntities) data.entities = entities;
  data.geo = { place_id: pid };
  data.lang = rng.chance(0.93) ? "en" : "und";
  data.public_metrics = {
    retweet_count: rng.chance(0.8) ? 0 : rng.int(1, 4),
    reply_count: rng.chance(0.75) ? 0 : rng.int(1, 3),
    like_count: rng.chance(0.4) ? 0 : rng.int(1, 40),
    quote_count: rng.chance(0.95) ? 0 : 1,
  };
  data.text = text;
  if (withSentiment) data.sentiment = Math.round((rng.next() * 2 - 1) * 1e15) / 1e15;

  const d = 0.02 + rng.next() * 0.2;
  return {
    _id: id,
    _rev: `${rng.int(1, 2)}-${rng.hex(32)}`,
    data,
    includes: {
      places: [
        {
          full_name: place.name,
          geo: {
            type: "Feature",
            bbox: [
              round6(place.lon - d),
              round6(place.lat - d),
              round6(place.lon + d),
              round6(place.lat + d),
            ],
            properties: {},
          },
          id: pid,
        },
      ],
    },
    matching_rules: [{ id: RULE_ID, tag: RULE_TAG }],
  };
}

/** Serialise one document as an element of a 2-space-indented JSON array. */
function serialiseElement(doc: TweetDoc): string {
  return JSON.stringify(doc, null, 2)
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

export interface SynthProgress {
  tweets: number;
  total: number;
}

/**
 * Yield the file as text pieces: "[\n", tweet, ",\n", tweet, …, "\n]\n".
 * Concatenate (or encode piecewise) to obtain the file.
 */
export function* generateSyntheticPieces(options: SynthOptions): Generator<string> {
  const total = Math.max(1, Math.floor(options.tweets));
  const rng = createRng(options.seed);
  const authors = makeAuthors(rng, options.authors ?? Math.max(12, Math.round(total / 24)));
  const pickAuthor = weightedSampler(authors.map((a) => a.weight));
  const pickPlace = weightedSampler(PLACES.map((p) => p.w));
  const span = END_MS - START_MS;

  yield "[\n";
  for (let i = 0; i < total; i++) {
    const ms = START_MS + ((i + rng.next()) / total) * span;
    const author = authors[pickAuthor(rng.next())];
    let placeIndex = author.home;
    if (author.traveller && rng.chance(0.45)) placeIndex = rng.pick(author.visits);
    else if (rng.chance(0.07)) placeIndex = pickPlace(rng.next());
    if (i > 0) yield ",\n";
    yield serialiseElement(buildTweet(rng, ms, author, placeIndex));
  }
  yield "\n]\n";
}

/** Convenience for tests / CLI: the whole file as bytes. */
export function generateSyntheticFile(options: SynthOptions): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let size = 0;
  let buffer = "";
  for (const piece of generateSyntheticPieces(options)) {
    buffer += piece;
    if (buffer.length > 1 << 20) {
      const bytes = encoder.encode(buffer);
      parts.push(bytes);
      size += bytes.length;
      buffer = "";
    }
  }
  const tail = encoder.encode(buffer);
  parts.push(tail);
  size += tail.length;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
