import { describe, expect, it } from "vitest";

import { createRng } from "../synth/prng";
import { decodeLine, decodeLineStrict, describeUtf8Error, UnicodeDecodeError } from "./decode";

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

describe("decodeLineStrict (Python's bytes.decode())", () => {
  const fatal = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

  it("decodes valid UTF-8 like the lenient path, but keeps a BOM", () => {
    for (const text of ["", "ascii\n", "café ☕ 墨尔本 😀\n"]) {
      expect(decodeLineStrict(te.encode(text))).toBe(text);
    }
    expect(decodeLineStrict(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b]))).toBe("\ufeff{");
  });

  it("raises on a line that starts mid-character, with CPython's message", () => {
    const line = te.encode("é ☕\n").subarray(1); // drop the lead byte of "é"
    expect(() => decodeLineStrict(line)).toThrow(UnicodeDecodeError);
    expect(() => decodeLineStrict(line)).toThrow(
      "UnicodeDecodeError: 'utf-8' codec can't decode byte 0xa9 in position 0: invalid start byte",
    );
  });

  it.each([
    [[0x61, 0xff], "can't decode byte 0xff in position 1: invalid start byte"],
    [[0x61, 0xc3, 0x28], "can't decode byte 0xc3 in position 1: invalid continuation byte"],
    [[0xe2, 0x98], "can't decode bytes in position 0-1: unexpected end of data"],
    [[0x61, 0xc3], "can't decode byte 0xc3 in position 1: unexpected end of data"],
    [[0xe0, 0x80, 0x80], "can't decode byte 0xe0 in position 0: invalid continuation byte"],
    [[0xc0, 0xaf], "can't decode byte 0xc0 in position 0: invalid start byte"],
  ])("describes %j as CPython does", (bytes, message) => {
    expect(describeUtf8Error(new Uint8Array(bytes))).toBe(message);
  });

  it("throws exactly when a fatal TextDecoder does, on random bytes", () => {
    const rng = createRng(7);
    for (let k = 0; k < 2000; k++) {
      const len = rng.int(0, 64);
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++)
        bytes[i] = rng.chance(0.6) ? rng.int(0x20, 0x7e) : rng.int(0x80, 0xff);
      let expected: string | null;
      try {
        expected = fatal.decode(bytes);
      } catch {
        expected = null;
      }
      if (expected === null) expect(() => decodeLineStrict(bytes)).toThrow(UnicodeDecodeError);
      else expect(decodeLineStrict(bytes)).toBe(expected);
    }
  });
});
