import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TrackRecordSummary } from "../../src/data/contract.gen.ts";
import { MATCHES_SHOWN, buildTrackRecord, type ComparisonView } from "../../src/data/track-record-view.ts";
import {
  comparisonDifference,
  displayVerdict,
  sampleSentence,
  trackRecordLine,
} from "../../src/format/track-record.ts";
import { MATURE_EXTRA, illustratedSummary, matureSummary } from "../fixtures/illustrated.ts";
import { REAL } from "./helpers.ts";

const asSummary = (x: unknown) => x as TrackRecordSummary;
const real = asSummary(JSON.parse(readFileSync(join(REAL, "track_record", "summary.json"), "utf8")));

describe("track record page model", () => {
  it("empty (the real 29 Sep file): nothing scored, no chart", () => {
    const view = buildTrackRecord(real);
    expect(view.counts.scored).toBe(0);
    expect(view.competitions.map((c) => c.name)).toEqual(["All leagues"]);
    expect(view.latestScored).toEqual([]);
    expect(view.showCalibrationChart).toBe(false);
    expect(view.liveSince).toBe("2026-09-29T16:31:51Z");
  });

  it("a few matches: newest first, still no chart", () => {
    const view = buildTrackRecord(asSummary(illustratedSummary()));
    expect(view.latestScored.map((m) => m.home)).toEqual(["Liverpool", "Chelsea", "Borussia Dortmund"]);
    expect(view.latestScored[2]).toMatchObject({ leagueName: "Bundesliga", score: { home: 3, away: 0 } });
    expect(view.showCalibrationChart).toBe(false);
  });

  it("mature: leagues in the site's order, after all leagues", () => {
    const view = buildTrackRecord(asSummary(matureSummary()));
    expect(view.competitions.map((c) => c.name)).toEqual([
      "All leagues",
      "Premier League",
      "Bundesliga",
      "La Liga",
      "Serie A",
    ]);
  });

  it("mature: enough matches against base rates (183 >= 152) shows the chart; the market (150 < 1,381) is not enough", () => {
    const view = buildTrackRecord(asSummary(matureSummary()));
    const all = view.competitions[0]!;
    expect(all.base?.enoughMatches).toBe(true);
    expect(all.market?.enoughMatches).toBe(false);
    expect(view.showCalibrationChart).toBe(true);
    expect(view.calibration.home).toHaveLength(3);
    expect(view.calibration.draw).toHaveLength(1);
  });

  it(`lists at most ${MATCHES_SHOWN} scored matches`, () => {
    const view = buildTrackRecord(asSummary(matureSummary()));
    expect(view.counts.scored).toBe(3 + MATURE_EXTRA);
    expect(view.latestScored).toHaveLength(MATCHES_SHOWN);
    const kickoffs = view.latestScored.map((m) => m.kickoffUtc ?? "");
    expect([...kickoffs].sort().reverse()).toEqual(kickoffs);
  });
});

describe("comparison wording", () => {
  const c = (over: Partial<ComparisonView>): ComparisonView => ({
    against: "base rates",
    n: 120,
    modelLogLoss: 0.98,
    otherLogLoss: 1.05,
    diff: -0.07,
    ci95: 0.03,
    firstHalf: -0.08,
    secondHalf: -0.06,
    verdict: "model better",
    matchesNeeded: 150,
    enoughMatches: false,
    ...over,
  });

  it("difference ± 95% interval, or a dash before there is one", () => {
    expect(comparisonDifference(c({}))).toBe("−0.070 ± 0.030");
    expect(comparisonDifference(c({ ci95: null }))).toBe("–");
  });

  it("an interval that includes zero is always 'no detectable difference'", () => {
    expect(displayVerdict(c({ diff: -0.02, ci95: 0.03, verdict: "model better" }))).toBe(
      "no detectable difference",
    );
    expect(displayVerdict(c({}))).toBe("model better");
    expect(displayVerdict(c({ diff: null, ci95: null, verdict: "too few matches to compare" }))).toBe(
      "too few matches to compare",
    );
  });

  it("too few to judge, with how many are needed and the backtest's gap", () => {
    expect(sampleSentence(c({}))).toBe(
      "120 matches so far, too few to judge: roughly 150 are needed to detect a gap the size the backtest found (0.08 in log loss).",
    );
    expect(sampleSentence(c({ against: "market", matchesNeeded: 1381 }))).toContain("roughly 1,381");
    expect(sampleSentence(c({ against: "market", matchesNeeded: 1381 }))).toContain("(0.02 in log loss)");
  });

  it("no sentence once there are enough matches, or none at all", () => {
    expect(sampleSentence(c({ enoughMatches: true }))).toBeNull();
    expect(sampleSentence(c({ n: 0 }))).toBeNull();
  });

  it("one match: too few to compare", () => {
    expect(sampleSentence(c({ n: 1, matchesNeeded: null }))).toBe("1 match so far: too few to compare yet.");
  });

  it("the home page line for the mature fixture", () => {
    expect(trackRecordLine(asSummary(matureSummary()))).toBe(
      "183 matches scored. Against base rates: model better (log loss difference −0.072 ± 0.044).",
    );
  });
});
