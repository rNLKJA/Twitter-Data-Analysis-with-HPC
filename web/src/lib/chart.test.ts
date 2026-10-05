import { describe, expect, it } from "vitest";

import { countTicks, linearScale, niceStep, niceTicks, niceTimeTicks } from "./chart";

describe("linearScale", () => {
  it("maps and inverts", () => {
    const x = linearScale([0, 10], [100, 200]);
    expect(x(0)).toBe(100);
    expect(x(5)).toBe(150);
    expect(x.invert(175)).toBe(7.5);
  });

  it("supports inverted ranges (y axes)", () => {
    const y = linearScale([0, 100], [300, 0]);
    expect(y(25)).toBe(225);
    expect(y.invert(0)).toBe(100);
  });
});

describe("niceTicks", () => {
  it("picks 1/2/2.5/5 steps", () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(2_284_909, 5)).toBe(500_000);
    expect(niceStep(68_477, 4)).toBe(20_000);
  });

  it("covers the maximum", () => {
    expect(niceTicks(2_284_909, 5)).toEqual([
      0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000,
    ]);
    expect(niceTicks(661, 4)).toEqual([0, 200, 400, 600, 800]);
    expect(niceTicks(8, 4)).toEqual([0, 2, 4, 6, 8]);
  });

  it("handles degenerate input", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("niceTimeTicks", () => {
  it("uses whole-minute steps for multi-minute ranges", () => {
    expect(niceTimeTicks(694, 5)).toEqual([0, 180, 360, 540, 720]);
    expect(niceTimeTicks(1452, 5)).toEqual([0, 300, 600, 900, 1200, 1500]);
  });

  it("uses second steps for short ranges", () => {
    expect(niceTimeTicks(7, 4)).toEqual([0, 2, 4, 6, 8]);
  });
});

describe("countTicks", () => {
  it("never produces fractional worker counts", () => {
    expect(countTicks(10, 4)).toEqual([1, 2, 4, 6, 8, 10]);
    expect(countTicks(32, 6)).toEqual([1, 10, 20, 30]);
    expect(countTicks(4, 4)).toEqual([1, 2, 3, 4]);
  });
});
