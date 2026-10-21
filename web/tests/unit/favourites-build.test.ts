// Build-time pieces of the favourite team: the home page's "Your team" card data, the QR codes, and the race chart's
// pre-built panels for teams outside the race.
import { describe, expect, it } from "vitest";
import type { ReadyLeague, Zone } from "../../src/data/models.ts";
import { QUIET_ZONE, qrSvg } from "../../src/data/qr.ts";
import { buildRace, chartPoints, loadLeagueHistory, type RunPoint } from "../../src/data/race.ts";
import { cardZones, yourTeamCards } from "../../src/data/your-team.ts";
import { writeIllustratedHistory } from "../fixtures/illustrated.ts";
import { copyOfReal, useDataDir } from "./helpers.ts";

describe('"Your team" card', () => {
  const zone = (id: string, positions: number[]): Zone =>
    ({ id, label: id, short: id, end: "top", marker: null, positions }) as Zone;

  it("shows title, top four (or top five), relegation, and the play-off place where there is one", () => {
    const zones = [
      zone("title", [1]),
      zone("top_four", [1, 2, 3, 4]),
      zone("top_five", [1, 2, 3, 4, 5]),
      zone("top_half", []),
      zone("relegation_playoff", [16]),
      zone("relegation", [17, 18]),
    ];
    expect(cardZones(zones).map((z) => z.id)).toEqual([
      "title",
      "top_four",
      "relegation",
      "relegation_playoff",
    ]);
    expect(cardZones([zone("title", [1]), zone("top_five", [1, 2, 3, 4, 5])]).map((z) => z.id)).toEqual([
      "title",
      "top_five",
    ]);
  });

  it("skips a match that had already kicked off when the snapshot was made", () => {
    const league = {
      generatedAt: "2026-10-10T12:00:00Z",
      zones: [],
      rows: [{ team: "Arsenal", position: 2, points: 12, played: 5, zoneChances: {} }],
      upcoming: [
        { home: "Arsenal", away: "Leeds United", kickoffUtc: "2026-10-10T11:30:00Z" },
        { home: "Nottingham Forest", away: "Arsenal", kickoffUtc: "2026-10-18T15:30:00Z" },
      ],
    } as unknown as ReadyLeague;
    expect(yourTeamCards(league)[0]!.next?.home).toBe("Nottingham Forest");
  });
});

describe("QR codes", () => {
  const svg = qrSvg("https://tabletalk.example/?team=borussia-monchengladbach");
  const size = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)![1]);

  it("are dark modules on a white background, whatever the theme", () => {
    expect(svg).toContain(`<rect width="${size}" height="${size}" fill="#fff"/>`);
    expect(svg).toContain('fill="#000"');
    expect(svg).not.toMatch(/var\(|currentcolor/i);
  });

  it("keep a quiet zone of 4 modules on every side", () => {
    const starts = [...svg.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
    ]);
    expect(starts.length).toBeGreaterThan(0);
    for (const [x, y, run] of starts) {
      expect(x).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(y).toBeGreaterThanOrEqual(QUIET_ZONE);
      expect(x! + run!).toBeLessThanOrEqual(size - QUIET_ZONE);
      expect(y).toBeLessThan(size - QUIET_ZONE);
    }
  });
});

describe("race chart: a pre-built panel for every team outside the race", () => {
  it("covers exactly the teams each chart leaves out", () => {
    const dir = copyOfReal();
    writeIllustratedHistory(dir, "premier_league");
    useDataDir(dir);
    const points: RunPoint[] = chartPoints(loadLeagueHistory("premier_league").points, "2026-27");
    const race = buildRace(points);
    const all = [...points.at(-1)!.teams.keys()];
    for (const chart of ["title", "relegation", "points"] as const) {
      const shown = race[chart].map((s) => s.team);
      const extra = race.extra[chart].map((s) => s.team);
      expect(
        extra.filter((t) => shown.includes(t)),
        chart,
      ).toEqual([]);
      expect([...shown, ...extra].sort(), chart).toEqual([...all].sort());
    }
  });
});

describe("the home page's card data", () => {
  it("is flat values for one shared template, formatted by the site's display rules", async () => {
    const { cardFields } = await import("../../src/data/your-team.ts");
    const fields = cardFields(
      {
        slug: "arsenal",
        name: "Arsenal",
        position: 2,
        points: 12,
        played: 5,
        chances: [
          { label: "Title", positions: [1], chance: 0.3431 },
          { label: "Relegation", positions: [18, 19, 20], chance: 0 },
        ],
        next: {
          home: "Arsenal",
          away: "Leeds United",
          kickoffUtc: "2026-10-10T11:30:00Z",
          probabilities: { home: 0.655417, draw: 0.223397, away: 0.121185 },
        },
      } as never,
      { name: "Premier League", slug: "premier-league" },
    );
    expect(fields).toMatchObject({
      n: "Arsenal",
      x: "Premier League · 2nd · 12 pts from 5",
      lh: "/premier-league/",
      c0s: "Title",
      c0v: "34",
      c1p: "18th–20th",
      c1v: "<1", // never 0% (the card adds the "%")
      mh: "Arsenal",
      ph: "66%",
      pd: "22%",
      pa: "12%", // largest remainder: adds to 100
    });
    expect(fields["c2s"]).toBeUndefined();
  });

  it("can't end its <script> element early", async () => {
    const { scriptJson } = await import("../../src/scripts/theme-script.ts");
    const json = scriptJson({ n: "</script><img src=x onerror=alert(1)>" });
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual({ n: "</script><img src=x onerror=alert(1)>" });
  });
});
