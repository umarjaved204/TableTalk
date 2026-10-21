// The finishing-position heatmap's cells: colour steps, printed values, and
// runs of blank cells merged into one.
import { describe, expect, it } from "vitest";
import { heatCells, heatLabel, heatStep } from "../../src/format/heat.ts";

describe("heat steps and labels", () => {
  it("blank under 0.5%, then seven steps", () => {
    expect([0, 0.004, 0.005, 0.03, 0.07, 0.15, 0.25, 0.4, 0.6, 1].map(heatStep)).toEqual([
      0, 0, 1, 2, 3, 4, 5, 6, 7, 7,
    ]);
    expect(heatLabel(0.004)).toBe("");
    expect(heatLabel(0.59)).toBe("59");
  });
});

describe("heatCells: runs of blank cells become one cell", () => {
  it("merges each run of blanks, keeps every value", () => {
    const cells = heatCells([0.59, 0.3, 0.1, 0.001, 0, 0.002, 0.006, 0, 0]);
    expect(cells.map((c) => [c.step, c.label, c.span])).toEqual([
      [6, "59", 1],
      [5, "30", 1],
      [3, "10", 1],
      [0, "", 3],
      [1, "1", 1],
      [0, "", 2],
    ]);
  });

  it("covers every position exactly once", () => {
    const row = [0, 0, 0.2, 0, 0.5, 0.3, 0, 0, 0, 0];
    expect(heatCells(row).reduce((sum, c) => sum + c.span, 0)).toBe(row.length);
  });

  it("a row with no blanks is unchanged; a row of blanks is one cell", () => {
    expect(heatCells([0.25, 0.25, 0.25, 0.25]).map((c) => c.span)).toEqual([1, 1, 1, 1]);
    expect(heatCells([0, 0, 0])).toEqual([{ step: 0, label: "", span: 3 }]);
  });
});
