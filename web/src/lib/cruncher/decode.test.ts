import { describe, expect, it } from "vitest";

import { createRng } from "../synth/prng";
import { decodeLine } from "./decode";

const td = new TextDecoder();
const te = new TextEncoder();

describe("decodeLine", () => {
  it.each([
    "",
    '      "_id": "1412189062442586000",\n',
    '        "full_name": "Melbourne, Victoria",\n',
    '        "full_name": "Ōtautahi, Canterbury — café ☕",\n',
    "emoji 😀 and CJK 墨尔本\n",
    "x".repeat(10_000),
    `${"a".repeat(5000)}é`,
  ])("matches TextDecoder for %j", (text) => {
    const bytes = te.encode(text);
    expect(decodeLine(bytes)).toBe(td.decode(bytes));
  });

  it("matches TextDecoder on random bytes, including invalid UTF-8", () => {
    const rng = createRng(42);
    for (let k = 0; k < 2000; k++) {
      const len = rng.int(0, 300);
      const bytes = new Uint8Array(len);
      const ascii = rng.chance(0.7);
      for (let i = 0; i < len; i++) bytes[i] = ascii ? rng.int(0, 0x7f) : rng.int(0, 0xff);
      expect(decodeLine(bytes)).toBe(td.decode(bytes));
    }
  });

  it("works on subarray views", () => {
    const whole = te.encode("first line\nsecond line\n");
    expect(decodeLine(whole.subarray(11, 23))).toBe("second line\n");
  });
});
