import { describe, expect, it } from "vitest";

import { amdahlSpeedup, efficiency, fitSerialFraction, karpFlatt, speedup } from "../amdahl";
import { formatClock } from "../format";
import {
  BENCHMARKS,
  DATASET,
  DEV_BENCHMARKS,
  parseTask3Text,
  TASK2,
  TASK2_TOTAL,
  TASK3,
} from "./original";

describe("transcribed original results", () => {
  it("Task 2 totals 6,789,772 tweets in capital cities (74.7% of bigTwitter.json)", () => {
    expect(TASK2_TOTAL).toBe(6_789_772);
    expect(TASK2_TOTAL / DATASET.tweets).toBeCloseTo(0.7468, 3);
    expect(TASK2.map((r) => r.gcc)).toEqual([...TASK2.map((r) => r.gcc)].sort());
  });

  it.each(TASK3.map((r) => [r.rank, r.text] as const))(
    "Task 3 row #%i is internally consistent",
    (_rank, text) => {
      const p = parseTask3Text(text);
      expect(p.breakdown).toHaveLength(p.gccCount);
      expect(p.breakdown.reduce((s, b) => s + b.tweets, 0)).toBe(p.tweets);
      const counts = p.breakdown.map((b) => b.tweets);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    },
  );

  it("Task 3 is ranked by city count, then tweets", () => {
    const parsed = TASK3.map((r) => parseTask3Text(r.text));
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i - 1].gccCount).toBeGreaterThanOrEqual(parsed[i].gccCount);
      expect(parsed[i - 1].tweets).toBeGreaterThanOrEqual(parsed[i].tweets);
    }
  });

  it("parses Slurm wall-clock strings", () => {
    expect(BENCHMARKS.map((b) => b.seconds)).toEqual([661, 101, 101]);
    expect(formatClock(661)).toBe("11:01");
    expect(DEV_BENCHMARKS[0].seconds).toBe(1383);
  });
});

describe("scaling arithmetic on the original benchmarks", () => {
  const [one, eight] = BENCHMARKS;
  const s8 = speedup(one.seconds, eight.seconds);

  it("8 cores were 6.54x faster than 1 core (81.8% parallel efficiency)", () => {
    expect(s8).toBeCloseTo(6.545, 3);
    expect(efficiency(s8, 8)).toBeCloseTo(0.818, 3);
  });

  it("implies a serial fraction of about 3.2% (Karp–Flatt)", () => {
    expect(karpFlatt(s8, 8)).toBeCloseTo(0.0318, 4);
    expect(fitSerialFraction([{ n: 8, s: s8 }])).toBeCloseTo(karpFlatt(s8, 8), 10);
    expect(amdahlSpeedup(karpFlatt(s8, 8), 8)).toBeCloseTo(s8, 10);
  });

  it("the earlier, slower revision scaled better (smaller serial fraction)", () => {
    const sDev = speedup(DEV_BENCHMARKS[0].seconds, DEV_BENCHMARKS[1].seconds);
    expect(sDev).toBeCloseTo(7.13, 2);
    expect(karpFlatt(sDev, 8)).toBeLessThan(karpFlatt(s8, 8));
  });
});
