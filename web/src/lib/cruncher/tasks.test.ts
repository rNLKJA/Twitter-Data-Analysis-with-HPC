import { describe, expect, it } from "vitest";

import type { TweetFrame } from "./processor";
import {
  compareIntStrings,
  countAuthorTweetsFromMostDifferentGcc,
  countNumberOfTweetsByGcc,
  reduceTask1,
  reduceTask2,
  reduceTask3,
  task1Csv,
} from "./tasks";

describe("compareIntStrings", () => {
  it("orders like int64, not like strings", () => {
    const ids = ["1000", "999", "1412193387575316482", "51378153"];
    expect([...ids].sort(compareIntStrings)).toEqual([
      "999",
      "1000",
      "51378153",
      "1412193387575316482",
    ]);
  });
});

describe("rank-local aggregations", () => {
  const frame: TweetFrame = {
    tweetId: ["1", "2", "3", "4", "5"],
    authorId: ["a1", "a1", "a2", "a2", "a2"].map((a) => a.replace("a", "")),
    location: ["", "", "", "", ""],
    gcc: ["1gsyd", "1rnsw", null, "2gmel", "9oter"],
  };

  it("drops null and rural (\\dr[a-z]{3}) cities but keeps 9oter", () => {
    expect(new Map(countNumberOfTweetsByGcc(frame))).toEqual(
      new Map([
        ["1gsyd", 1],
        ["2gmel", 1],
        ["9oter", 1],
      ]),
    );
    expect(countAuthorTweetsFromMostDifferentGcc(frame)).toHaveLength(3);
  });
});

describe("reduceTask1 (rank method='min', keep rank <= 10)", () => {
  it("reproduces the tie handling of the original tinyTwitter output", () => {
    // per-author totals from the original run on tinyTwitter.json, split across two "ranks"
    const totals: Array<[string, number]> = [
      ["51378153", 32],
      ["384233102", 23],
      ["156677140", 17],
      ["1244795045934280704", 13],
      ["213903403", 11],
      ["279323894", 11],
      ["99367063", 9],
      ["4648031797", 9],
      ["986277960", 8],
      ["7050962", 7],
      ["30839139", 7],
      ["935936493201305601", 7],
      ["20522796", 6],
    ];
    const partA = totals.map(([a, n]) => [a, Math.floor(n / 2)] as const);
    const partB = totals.map(([a, n]) => [a, n - Math.floor(n / 2)] as const);
    expect(task1Csv(reduceTask1([partA, partB]))).toEqual([
      ["Rank", "Author Id", "Number of Tweets Made"],
      ["#1", "51378153", "32"],
      ["#2", "384233102", "23"],
      ["#3", "156677140", "17"],
      ["#4", "1244795045934280704", "13"],
      ["#5", "213903403", "11"],
      ["#5", "279323894", "11"],
      ["#7", "99367063", "9"],
      ["#7", "4648031797", "9"],
      ["#9", "986277960", "8"],
      ["#10", "7050962", "7"],
      ["#10", "30839139", "7"],
      ["#10", "935936493201305601", "7"],
    ]);
  });
});

describe("reduceTask2", () => {
  it("sums partials and sorts by gcc code", () => {
    expect(
      reduceTask2([
        [
          ["2gmel", 3],
          ["1gsyd", 1],
        ],
        [["1gsyd", 4]],
      ]),
    ).toEqual([
      { gcc: "1gsyd", tweets: 5 },
      { gcc: "2gmel", tweets: 3 },
    ]);
  });
});

describe("reduceTask3", () => {
  it("ranks by distinct cities, then tweets, and formats like the original CSV", () => {
    const { rows, detail } = reduceTask3([
      [
        ["10", "1gsyd", 5],
        ["10", "2gmel", 1],
        ["20", "1gsyd", 1],
      ],
      [
        ["10", "1gsyd", 2],
        ["20", "2gmel", 1],
        ["20", "3gbri", 1],
        ["30", "8acte", 9],
      ],
    ]);
    expect(rows.map((r) => [r.rank, r.authorId, r.text])).toEqual([
      [1, "20", "3 (#3 tweets - #1gsyd, #1gmel, #1gbri)"],
      [2, "10", "2 (#8 tweets - #7gsyd, #1gmel)"],
      [3, "30", "1 (#9 tweets - #9acte)"],
    ]);
    expect(detail[0]).toEqual(["30", "8acte", 9]);
  });

  it("keeps only ten authors (ordinal rank)", () => {
    const part = Array.from({ length: 15 }, (_, i) => [String(i + 1), "1gsyd", 1] as const);
    expect(reduceTask3([part]).rows).toHaveLength(10);
  });
});
