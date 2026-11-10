import { describe, expect, it } from "vitest";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { RACE_SIZE, cardValues, seasonChancesSentence, zoneLeaders } from "../../src/data/home.ts";
import { loadLeague } from "../../src/data/league.ts";
import { LEAGUES } from "../../src/data/leagues.ts";
import type { ReadyLeague, TeamRow, Zone } from "../../src/data/models.ts";
import { formatPlaces } from "../../src/format/number.ts";
import { formatChance } from "../../src/format/probability.ts";
import { formatDifference, includesZero, trackRecordLine } from "../../src/format/track-record.ts";
import { illustratedSummary } from "../fixtures/illustrated.ts";
import { REAL, useDataDir } from "./helpers.ts";

function ready(id: string): ReadyLeague {
  useDataDir(REAL);
  const data = loadLeague(LEAGUES.find((l) => l.id === id)!);
  if (data.state !== "ready") throw new Error(data.state);
  return data;
}

describe("home page cards: title races at a glance (real 29 Sep files)", () => {
  it("Premier League: the top three for the title and for relegation", () => {
    const values = cardValues(ready("premier_league"));
    expect(values.title.map((l) => l.team)).toEqual(["Manchester City", "Arsenal", "Liverpool"]);
    expect(formatChance(values.title[0]!.chance)).toBe("59%");
    expect(values.relegation[0]!.team).toBe("Coventry City");
    expect(values.relegation).toHaveLength(RACE_SIZE);
    expect(formatPlaces(values.relegation[0]!.zone.positions)).toBe("18th–20th");
  });

  it.each([["bundesliga"], ["ligue_1"]])(
    "%s (six zones): relegation means the direct places, 17th–18th",
    (id) => {
      const values = cardValues(ready(id));
      expect(formatPlaces(values.relegation[0]!.zone.positions)).toBe("17th–18th");
    },
  );

  it("always three per race, highest chance first, and the first is the league's highest", () => {
    for (const league of LEAGUES) {
      const data = ready(league.id);
      const values = cardValues(data);
      for (const [race, zone] of [
        [values.title, "title"],
        [values.relegation, "relegation"],
      ] as const) {
        expect(race).toHaveLength(RACE_SIZE);
        const chances = race.map((l) => l.chance);
        expect(chances).toEqual([...chances].sort((a, b) => b - a));
        expect(chances[0]).toBe(Math.max(...data.rows.map((r) => r.zoneChances[zone] ?? 0)));
      }
    }
  });

  it("never shows 0% or 100%", () => {
    for (const league of LEAGUES) {
      const values = cardValues(ready(league.id));
      for (const leader of [...values.title, ...values.relegation]) {
        expect(["0%", "100%"]).not.toContain(formatChance(leader.chance));
      }
    }
  });

  it("ties: higher in the table for a top zone, lower for a bottom zone", () => {
    const row = (team: string, position: number, chance: number) =>
      ({ team, position, zoneChances: { z: chance } }) as unknown as TeamRow;
    const rows = [row("A", 1, 0.3), row("B", 2, 0.3), row("C", 3, 0.1), row("D", 4, 0)];
    const zone = (end: "top" | "bottom") => ({ id: "z", end }) as Zone;
    expect(zoneLeaders(rows, zone("top")).map((l) => l.team)).toEqual(["A", "B", "C"]);
    expect(zoneLeaders(rows, zone("bottom")).map((l) => l.team)).toEqual(["B", "A", "C"]);
    expect(zoneLeaders(rows, undefined)).toEqual([]);
  });
});

describe("what a season chance means", () => {
  it("names the number of simulated seasons when every league uses the same one", () => {
    expect(seasonChancesSentence([10000, 10000, 10000])).toBe(
      "Season chances are the share of 10,000 simulated seasons that ended that way.",
    );
  });

  it("is left out when the leagues differ, or none has a forecast", () => {
    expect(seasonChancesSentence([10000, 5000])).toBeNull();
    expect(seasonChancesSentence([])).toBeNull();
  });
});

describe("one-line track record summary", () => {
  const real = (): TrackRecordSummary => illustratedSummary() as unknown as TrackRecordSummary;
  /** Base rates only, with enough matches to judge. */
  const withBase = (diff: number | null, ci95: number | null, verdict: string, scored = 120, n = scored) => {
    const summary = real();
    summary.counts.scored = scored;
    const all = summary.competitions[0]!;
    all.comparisons = [
      { ...all.comparisons[0]!, n, matches_needed: 73, diff, ci95, verdict: verdict as never },
    ];
    return summary;
  };
  /** Adds a market comparison to a summary from withBase. */
  const withMarket = (
    summary: TrackRecordSummary,
    market: { n: number; needed: number | null; diff: number | null; ci95: number | null; verdict: string },
  ) => {
    const all = summary.competitions[0]!;
    all.comparisons.push({
      ...all.comparisons[0]!,
      against: "market",
      n: market.n,
      matches_needed: market.needed,
      diff: market.diff,
      ci95: market.ci95,
      verdict: market.verdict as never,
    });
    return summary;
  };
  const MODEL_BETTER = [-0.031, 0.012, "model better"] as const;

  it("nothing scored yet", () => {
    expect(trackRecordLine(withBase(null, null, "no scored matches yet", 0))).toBe("No matches scored yet.");
  });

  it("too few to compare", () => {
    expect(trackRecordLine(real())).toBe("3 matches scored: too few to compare yet.");
  });

  it("interval includes zero: no detectable difference", () => {
    expect(trackRecordLine(withBase(-0.004, 0.02, "no detectable difference"))).toBe(
      "120 matches scored. Compared with league-average forecasts: no detectable difference.",
    );
  });

  it("interval excludes zero: the pipeline's verdict, in plain words, never 'beats'", () => {
    const line = trackRecordLine(withBase(...MODEL_BETTER));
    expect(line).toBe("120 matches scored. Compared with league-average forecasts: model better.");
    expect(line).not.toMatch(/beat|log loss|base rate/i);
  });

  it("fewer matches than needed: too few to judge, whatever the verdict says", () => {
    expect(trackRecordLine(withBase(...MODEL_BETTER, 120, 40))).toBe(
      "120 matches scored. Compared with league-average forecasts: too few to judge so far.",
    );
  });

  it("market with a result but too few matches: too few to judge", () => {
    const summary = withMarket(withBase(...MODEL_BETTER), {
      n: 120,
      needed: 187,
      diff: 0.012,
      ci95: 0.023,
      verdict: "no detectable difference",
    });
    expect(trackRecordLine(summary)).toBe(
      "120 matches scored. Compared with league-average forecasts: model better. Compared with bookmakers' odds: too few to judge so far.",
    );
  });

  it("market with enough matches: its verdict, and zero in the interval still decides", () => {
    const market = { n: 200, needed: 187, ci95: 0.02 };
    expect(
      trackRecordLine(
        withMarket(withBase(...MODEL_BETTER), { ...market, diff: 0.03, verdict: "model worse" }),
      ),
    ).toMatch(/Compared with bookmakers' odds: model worse\.$/);
    expect(
      trackRecordLine(
        withMarket(withBase(...MODEL_BETTER), { ...market, diff: 0.01, verdict: "model worse" }),
      ),
    ).toMatch(/Compared with bookmakers' odds: no detectable difference\.$/);
  });

  it("market with no result yet, or missing: the bookmakers' half is left out", () => {
    const base = "120 matches scored. Compared with league-average forecasts: model better.";
    expect(trackRecordLine(withBase(...MODEL_BETTER))).toBe(base);
    for (const verdict of ["no scored matches yet", "too few matches to compare"]) {
      const market = { n: 0, needed: null, diff: null, ci95: null, verdict };
      expect(trackRecordLine(withMarket(withBase(...MODEL_BETTER), market))).toBe(base);
    }
  });

  it("the interval decides: if it includes zero, it is 'no detectable difference' whatever the verdict says", () => {
    expect(trackRecordLine(withBase(-0.01, 0.02, "model better"))).toMatch(/no detectable difference/);
    expect(includesZero(0.02, 0.02)).toBe(true);
    expect(formatDifference(0.012, 0.008)).toBe("+0.012 ± 0.008");
  });
});
