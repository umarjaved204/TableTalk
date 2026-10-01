import { describe, expect, it } from "vitest";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { cardValues, zoneLeader } from "../../src/data/home.ts";
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

describe("home page card values (real 29 Sep files)", () => {
  it("Premier League: favourite, most at risk, no play-off place", () => {
    const values = cardValues(ready("premier_league"));
    expect(values.favourite?.team).toBe("Manchester City");
    expect(formatChance(values.favourite!.chance)).toBe("59%");
    expect(values.relegation?.team).toBe("Coventry City");
    expect(formatPlaces(values.relegation!.zone.positions)).toBe("18th–20th");
    expect(values.playoff).toBeNull();
  });

  it.each([["bundesliga"], ["ligue_1"]])("%s (six zones): also the play-off place, 16th", (id) => {
    const values = cardValues(ready(id));
    expect(formatPlaces(values.relegation!.zone.positions)).toBe("17th–18th");
    expect(values.playoff).not.toBeNull();
    expect(formatPlaces(values.playoff!.zone.positions)).toBe("16th");
    expect(values.playoff!.team).not.toBe(values.relegation!.team);
  });

  it("every card value is the highest chance in the league", () => {
    for (const league of LEAGUES) {
      const data = ready(league.id);
      const values = cardValues(data);
      const max = (zone: string) => Math.max(...data.rows.map((r) => r.zoneChances[zone] ?? 0));
      expect(values.favourite!.chance).toBe(max("title"));
      expect(values.relegation!.chance).toBe(max("relegation"));
    }
  });

  it("never shows 0% or 100%", () => {
    for (const league of LEAGUES) {
      const values = cardValues(ready(league.id));
      for (const leader of [values.favourite, values.relegation, values.playoff]) {
        if (leader) expect(["0%", "100%"]).not.toContain(formatChance(leader.chance));
      }
    }
  });

  it("ties: higher in the table for a top zone, lower for a bottom zone", () => {
    const row = (team: string, position: number, chance: number) =>
      ({ team, position, zoneChances: { z: chance } }) as unknown as TeamRow;
    const rows = [row("A", 1, 0.3), row("B", 2, 0.3), row("C", 3, 0.1)];
    const zone = (end: "top" | "bottom") => ({ id: "z", end }) as Zone;
    expect(zoneLeader(rows, zone("top"))?.team).toBe("A");
    expect(zoneLeader(rows, zone("bottom"))?.team).toBe("B");
  });
});

describe("one-line track record summary", () => {
  const real = (): TrackRecordSummary => illustratedSummary() as unknown as TrackRecordSummary;
  const withBase = (diff: number | null, ci95: number | null, verdict: string, scored = 120) => {
    const summary = real();
    summary.counts.scored = scored;
    summary.competitions[0]!.comparisons[0] = {
      ...summary.competitions[0]!.comparisons[0]!,
      diff,
      ci95,
      verdict: verdict as never,
    };
    return summary;
  };

  it("nothing scored yet", () => {
    expect(trackRecordLine(withBase(null, null, "no scored matches yet", 0))).toBe("No matches scored yet.");
  });

  it("too few to compare", () => {
    expect(trackRecordLine(real())).toBe("3 matches scored: too few to compare yet.");
  });

  it("interval includes zero: no detectable difference, with difference ± interval", () => {
    expect(trackRecordLine(withBase(-0.004, 0.02, "no detectable difference"))).toBe(
      "120 matches scored. Against base rates: no detectable difference (log loss difference −0.004 ± 0.020).",
    );
  });

  it("interval excludes zero: the pipeline's verdict, never 'beats'", () => {
    const line = trackRecordLine(withBase(-0.031, 0.012, "model better"));
    expect(line).toBe(
      "120 matches scored. Against base rates: model better (log loss difference −0.031 ± 0.012).",
    );
    expect(line).not.toMatch(/beat/i);
  });

  it("the interval decides: if it includes zero, it is 'no detectable difference' whatever the verdict says", () => {
    expect(trackRecordLine(withBase(-0.01, 0.02, "model better"))).toMatch(/no detectable difference/);
    expect(includesZero(0.02, 0.02)).toBe(true);
    expect(formatDifference(0.012, 0.008)).toBe("+0.012 ± 0.008");
  });
});
