import { describe, expect, it } from "vitest";

import expected from "../__fixtures__/sal-mini.expected.json";
import salMini from "../__fixtures__/sal-mini.json";
import { processSalV1 } from "./sal";

describe("processSalV1 (port of sal_processor.process_salV1)", () => {
  it("matches the dictionary the original Python builds from the same file", () => {
    // sal-mini.expected.json was produced by scripts/run_original.py --dump-sal-dict
    const dict = processSalV1(salMini);
    expect(Object.fromEntries(dict)).toEqual(expected);
  });

  it("keeps Python's dict insertion order", () => {
    expect([...processSalV1(salMini).keys()]).toEqual(Object.keys(expected));
  });

  it("lets later bigram rows override an original key", () => {
    const dict = processSalV1(salMini);
    // "box hill" is 2rvic in the file but the "box hill vic" bigram comes last
    expect(dict.get("box hill")).toBe("2gmel");
  });
});
