import { describe, expect, it } from "vitest";

import { GCC_LIST } from "../gcc";
import { australiaMap } from "./australia";

describe("australiaMap", () => {
  const map = australiaMap(800, 680);

  it("produces a compact outline", () => {
    expect(map.outline.startsWith("M")).toBe(true);
    expect(map.outline.length).toBeLessThan(30_000);
  });

  it("projects every mainland capital inside the frame, in the right relative places", () => {
    const pts = Object.fromEntries(
      GCC_LIST.filter((g) => g.code !== "9oter").map((g) => [g.city, map.project(g.lon, g.lat)]),
    );
    for (const [x, y] of Object.values(pts)) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(680);
    }
    expect(pts.Perth[0]).toBeLessThan(pts.Adelaide[0]);
    expect(pts.Adelaide[0]).toBeLessThan(pts.Melbourne[0]);
    expect(pts.Melbourne[0]).toBeLessThan(pts.Sydney[0]);
    expect(pts.Darwin[1]).toBeLessThan(pts.Brisbane[1]);
    expect(pts.Hobart[1]).toBeGreaterThan(pts.Melbourne[1]);
  });
});
