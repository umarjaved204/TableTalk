// The site ships only the Latin and Latin Extended font subsets
// (src/styles/fonts.css). These tests check that every character the site
// is likely to print has a font file that covers it, so no name falls back
// to a system font halfway through.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/contract.gen.ts";
import { LEAGUES } from "../../src/data/leagues.ts";
import { REAL } from "./helpers.ts";

const css = readFileSync(resolve("src/styles/fonts.css"), "utf8");

/** Every @font-face's family and unicode-range, as [start, end] code points. */
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const body = m[1] ?? "";
  const family = /font-family:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
  const ranges = (/unicode-range:([^;]+);/.exec(body)?.[1] ?? "").split(",").map((part) => {
    const [start = "0", end] = part.trim().replace(/^U\+/, "").split("-");
    return [parseInt(start, 16), parseInt(end ?? start, 16)] as const;
  });
  return { family, ranges };
});

const FAMILIES = ["Barlow Condensed", "Source Sans 3 Variable"];

/** The characters in `text` that no face of `family` covers. */
function uncovered(text: string, family: string): string[] {
  const ranges = faces.filter((f) => f.family === family).flatMap((f) => f.ranges);
  return [...new Set(text)].filter((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return !ranges.some(([start, end]) => code >= start && code <= end);
  });
}

describe("font subsets cover what the site prints", () => {
  it("declares Latin and Latin Extended faces for both families, and nothing else", () => {
    for (const family of FAMILIES)
      expect(faces.filter((f) => f.family === family).length).toBeGreaterThanOrEqual(2);
    expect(css).not.toMatch(/cyrillic|greek|vietnamese|\.woff"/);
  });

  it.each([
    ["Borussia Mönchengladbach"],
    ["Deportivo Alavés"],
    ["Ołeksandr Zinczenko"], // ł: Latin Extended-A
    ["Atlético Madrid · Bayern München · Kasımpaşa · Draguşin · Šeško · Čolak · Ødegaard · Groß"],
    ["−12 · 59% · 2–1 · “quoted” · €"], // minus sign, en dash, curly quotes
  ])("%s", (text) => {
    for (const family of FAMILIES) expect(uncovered(text, family), family).toEqual([]);
  });

  it("every team name in the real data (all five leagues)", () => {
    const names = LEAGUES.flatMap((league) => {
      const snap = JSON.parse(readFileSync(join(REAL, "latest", `${league.id}.json`), "utf8")) as Snapshot;
      return snap.table.map((row) => row.team);
    });
    expect(names.length).toBe(96); // 20 + 18 + 20 + 20 + 18
    for (const family of FAMILIES) expect(uncovered(names.join(""), family), family).toEqual([]);
  });
});
