// The methodology page's backtest numbers are copied by hand from the
// project README (until contract request R10). This test reads the README
// and fails if the copy no longer matches it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKTESTS, PREMIER_LEAGUE_LOG_LOSS } from "../../src/data/backtests.ts";

const readme = readFileSync(resolve("..", "README.md"), "utf8");

/** Only the "five leagues side by side" section: other tables reuse row names. */
const HEADING = "## Phase 2: the five leagues side by side";
const start = readme.indexOf(HEADING);
const section = readme.slice(start, readme.indexOf("\n## ", start + HEADING.length));

/** The cells of the section's table row that starts with `label`, one per league. */
function row(label: string): string[] {
  const line = section.split("\n").find((l) => l.startsWith(`| ${label} |`));
  if (!line) throw new Error(`README has no row "${label}"`);
  return line
    .split("|")
    .slice(2, -1)
    .map((cell) => cell.trim());
}

const fixed = (x: number, digits: number) => x.toFixed(digits);
const minus = (x: number) => (x < 0 ? `−${fixed(-x, 1)}` : fixed(x, 1));

describe("backtest numbers match the README's five-leagues table", () => {
  it("lists the leagues in the README's order", () => {
    expect(start, `README has no "${HEADING}"`).toBeGreaterThan(-1);
    const header = section.split("\n").find((l) => l.startsWith("| | Premier League |"));
    expect(header).toBe("| | Premier League | Bundesliga | La Liga | Serie A | Ligue 1 |");
    expect(BACKTESTS.map((b) => b.leagueId)).toEqual([
      "premier_league",
      "bundesliga",
      "la_liga",
      "serie_a",
      "ligue_1",
    ]);
  });

  it.each([
    ["matches", (b: (typeof BACKTESTS)[number]) => b.matches.toLocaleString("en-GB")],
    ["log loss vs base rates", (b: (typeof BACKTESTS)[number]) => `${minus(b.vsBaseRatesPercent)}%`],
    ["share of the gap to the market closed", (b: (typeof BACKTESTS)[number]) => `${b.gapClosedPercent}%`],
    [
      "model minus market, log loss",
      (b: (typeof BACKTESTS)[number]) => `${fixed(b.minusMarket.diff, 3)} ± ${fixed(b.minusMarket.ci95, 3)}`,
    ],
    [
      "match calibration gap, home / draw / away (pts)",
      (b: (typeof BACKTESTS)[number]) =>
        [b.calibrationGap.home, b.calibrationGap.draw, b.calibrationGap.away]
          .map((x) => fixed(x, 1))
          .join(" / "),
    ],
  ])("%s", (label, cell) => {
    expect(BACKTESTS.map(cell)).toEqual(row(label));
  });

  it("Premier League log losses (model, base rates, market)", () => {
    const line = (name: string) => readme.split("\n").find((l) => l.startsWith(`| ${name} |`));
    expect(line("model")).toContain(`| ${PREMIER_LEAGUE_LOG_LOSS.model} |`);
    expect(line("knows nothing (base rates)")).toContain(`| ${PREMIER_LEAGUE_LOG_LOSS.baseRates} |`);
    expect(line("market")).toContain(`**${PREMIER_LEAGUE_LOG_LOSS.market}**`);
  });
});
