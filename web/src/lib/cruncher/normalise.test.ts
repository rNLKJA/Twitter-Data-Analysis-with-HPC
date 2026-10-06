import { describe, expect, it } from "vitest";

import {
  firstNgrams,
  isStateLocation,
  ngramCount,
  normaliseLocation,
  resolveLocation,
  resolveLocationBounded,
  returnWordsNgrams,
} from "./normalise";

describe("normaliseLocation (port of utils.normalise_location)", () => {
  // Expected values are the `location` column the original produced on real
  // tinyTwitter.json full_name strings (lower-cased by the caller first).
  it.each([
    ["Sydney, New South Wales", "sydney nsw"],
    ["Melbourne, Victoria", "melbourne vic"],
    ["Canberra, Australian Capital Territory", "canberra act"],
    ["Western Australia, Australia", "wa australia"],
    ["South Australia, Australia", "sa australia"],
    ["Shepparton - Mooroopna, Victoria", "shepparton mooroopna vic"],
    ["Airlie Beach - Cannonvale, Queensland", "airlie beach cannonvale qld"],
    ["Toronto, Ontario", "toronto ontario"],
    ["Australia", "australia"],
  ])("%s -> %s", (fullName, expected) => {
    expect(normaliseLocation(fullName.toLowerCase())).toBe(expected);
  });

  it("keeps the capitalised gccs check that can never fire on lower-cased input", () => {
    // Called with the raw string the special case would trigger…
    expect(normaliseLocation("Sydney, New South Wales")).toBe("sydney");
    // …but the processor always lower-cases first, so it does not.
    expect(normaliseLocation("sydney, new south wales")).toBe("sydney nsw");
  });

  it("removes punctuation with Python's Unicode \\w semantics", () => {
    expect(normaliseLocation("são paulo, brasil!")).toBe("são paulo brasil");
    expect(normaliseLocation("o'connor, act")).toBe("oconnor act");
  });

  it("does not strip leading/trailing spaces (only collapses runs)", () => {
    expect(normaliseLocation("  perth,   wa ")).toBe(" perth wa ");
  });

  it("flags state-only locations like the original list", () => {
    expect(isStateLocation("nsw australia")).toBe(true);
    expect(isStateLocation("qld australia")).toBe(false); // the original list has "qld Australia"
  });
});

describe("returnWordsNgrams (port of itertools.combinations order)", () => {
  it("matches the output printed in the original smallTwitter notebook", () => {
    expect(returnWordsNgrams(["hello", "world", "how"])).toEqual([
      "hello",
      "world",
      "how",
      "hello world",
      "hello how",
      "world how",
      "hello world how",
    ]);
  });

  it("produces 2^n - 1 combinations", () => {
    expect(returnWordsNgrams("a b c d e".split(" "))).toHaveLength(31);
  });
});

describe("resolveLocation", () => {
  const dict = new Map([
    ["sydney", "1gsyd"],
    ["macquarie", "8acte"],
    ["bay qld", "3gbri"],
  ]);

  it("returns the first n-gram hit, single words first", () => {
    expect(resolveLocation("Macquarie Park, Sydney", dict)).toEqual({
      location: "macquarie park sydney",
      gcc: "8acte",
      matchedBy: "macquarie",
      tried: 1,
    });
  });

  it("can match on a non-contiguous combination", () => {
    expect(resolveLocation("Hervey Bay, Queensland", dict).matchedBy).toBe("bay qld");
  });

  it("returns null when nothing matches", () => {
    expect(resolveLocation("London, England", dict)).toMatchObject({ gcc: null, tried: 3 });
  });
});

describe("resolveLocationBounded (the place matcher's capped lookup)", () => {
  const dict = new Map([
    ["sydney", "1gsyd"],
    ["bay qld", "3gbri"],
  ]);

  it("agrees with resolveLocation whenever the search fits under the ceiling", () => {
    for (const place of ["Hervey Bay, Queensland", "Sydney", "London, England", "a b c d e f g"]) {
      const full = resolveLocation(place, dict);
      const bounded = resolveLocationBounded(place, dict, 1000);
      expect(bounded).toEqual({
        ...full,
        complete: true,
        total: ngramCount(full.location.split(" ").length),
      });
    }
  });

  it("stops at the ceiling on long unmatched input instead of trying 2^n − 1 combinations", () => {
    const place = Array.from({ length: 40 }, (_, i) => String.fromCharCode(97 + (i % 26))).join(
      " ",
    );
    const r = resolveLocationBounded(place, dict, 5000);
    expect(r).toMatchObject({ gcc: null, tried: 5000, complete: false, total: 2 ** 40 - 1 });
  });

  it("firstNgrams takes a prefix of return_words_ngrams lazily", () => {
    const words = "a b c d e".split(" ");
    expect(firstNgrams(words, 7)).toEqual(returnWordsNgrams(words).slice(0, 7));
    expect(firstNgrams(words, 100)).toHaveLength(31);
    expect(
      firstNgrams(
        Array.from({ length: 60 }, (_, i) => `w${i}`),
        3,
      ),
    ).toEqual(["w0", "w1", "w2"]);
  });
});
