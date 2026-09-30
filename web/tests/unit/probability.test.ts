import { describe, expect, it } from "vitest";
import { formatChance, matchPercents, roundToHundred } from "../../src/format/probability.ts";

describe("formatChance: never 0% or 100% unless the data says certain", () => {
  it.each([
    [0, "<1%"], // an exact 0.0 means "not in 10,000 simulations", not impossible
    [0.0001, "<1%"],
    [0.00499, "<1%"],
    [0.005, "1%"],
    [0.0149, "1%"],
    [0.587, "59%"],
    [0.9949, "99%"],
    [0.99501, ">99%"],
    [0.9996, ">99%"],
    [1, ">99%"],
  ])("%s -> %s", (p, expected) => {
    expect(formatChance(p)).toBe(expected);
  });

  it("shows 0% and 100% only for outcomes marked certain (contract request R1)", () => {
    expect(formatChance(0, "impossible")).toBe("0%");
    expect(formatChance(1, "certain")).toBe("100%");
  });

  it("rejects values that are not probabilities", () => {
    expect(() => formatChance(1.2)).toThrow(RangeError);
    expect(() => formatChance(Number.NaN)).toThrow(RangeError);
  });
});

describe("roundToHundred: largest remainder method", () => {
  it("fixes a set that plain rounding leaves at 99", () => {
    // Plain rounding: 66 + 22 + 12 = 100 here, but floors give 65 + 22 + 12 = 99,
    // and the missing point goes to the biggest remainder (.54).
    expect(roundToHundred([0.6554, 0.2234, 0.1212])).toEqual([66, 22, 12]);
  });

  it("fixes a set that plain rounding pushes to 101", () => {
    // Plain rounding: 34 + 34 + 33 = 101.
    expect(roundToHundred([0.335, 0.335, 0.33])).toEqual([34, 33, 33]);
  });

  it("splits three equal chances 34 / 33 / 33 (ties go to the first)", () => {
    expect(roundToHundred([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33]);
  });

  it("handles exact halves", () => {
    expect(roundToHundred([0.495, 0.495, 0.01])).toEqual([50, 49, 1]);
  });

  it("never shows a possible outcome as 0 (takes the point from the largest)", () => {
    expect(roundToHundred([0.996, 0.003, 0.001])).toEqual([98, 1, 1]);
  });

  it("accepts the contract's 6-decimal rounding (sums a hair off 1)", () => {
    expect(roundToHundred([0.655417, 0.223397, 0.121185])).toEqual([66, 22, 12]);
  });

  it("always adds up to exactly 100 (1,000 random sets)", () => {
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 1000; i++) {
      const raw = [random(), random(), random()];
      const total = raw.reduce((a, b) => a + b, 0);
      const set = roundToHundred(raw.map((x) => x / total));
      expect(set.reduce((a, b) => a + b, 0)).toBe(100);
      expect(Math.min(...set)).toBeGreaterThanOrEqual(1);
    }
  });

  it("refuses sets that don't add up to 1", () => {
    expect(() => roundToHundred([0.5, 0.3, 0.1])).toThrow(RangeError);
  });
});

describe("matchPercents", () => {
  it("rounds a real match (Arsenal v Leeds, 29 Sep run)", () => {
    expect(matchPercents({ home: 0.655417, draw: 0.223397, away: 0.121185 })).toEqual({
      home: 66,
      draw: 22,
      away: 12,
    });
  });
});
