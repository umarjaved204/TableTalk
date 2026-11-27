// The identity system: club crests, league marks and band colours
// (src/identity/). Checks that
//   - every club in the covered leagues has a registry entry, keyed by the
//     slug the site makes from its name (against a saved club list, never
//     the live data: a newly promoted club must not fail the nightly build;
//     it gets the fallback crest and a warning instead);
//   - the committed SVG and CSS files are exactly what the designs draw;
//   - every SVG is safe to serve and inside its size budget;
//   - every band's text passes WCAG contrast, like the theme colours;
//   - a design that may look close to an official badge has an alternative.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import { SLUG_PATTERN, teamSlug } from "../../src/data/teams.ts";
import { crestSource, svgElement, variantFor } from "../../src/identity/assets.ts";
import { identityFiles } from "../../src/identity/build.ts";
import { CLUBS, clubIdentity, slugMatchesName } from "../../src/identity/clubs/index.ts";
import { fallbackDesign, initials, renderCrest } from "../../src/identity/crest.ts";
import { LEAGUE_IDENTITIES } from "../../src/identity/leagues.ts";
import { LetteringError, arcText, lineText, mapPath } from "../../src/identity/lettering.ts";
import type { BandColours } from "../../src/identity/types.ts";

/** Leagues whose crests are drawn. The other four follow on the crest-registry branch. */
const COVERED = ["premier_league"];

const SEASON = JSON.parse(readFileSync(resolve("tests/fixtures/clubs-2026-27.json"), "utf8")) as {
  leagues: Record<string, string[]>;
};

// WCAG 2.2 relative luminance and contrast ratio (as in themes.test.ts).
function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
/** `share` of colour a mixed into b, as color-mix(in srgb) does. */
function mix(a: string, b: string, share: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(v * share + y[i]! * (1 - share))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** The band art share in tokens/base.css: artwork in a band is the ink at this strength. */
const BAND_ART_SHARE =
  Number(
    /--band-art-share:\s*([\d.]+)%/.exec(readFileSync(resolve("src/styles/tokens/base.css"), "utf8"))![1],
  ) / 100;

function checkBand(band: BandColours): void {
  expect(contrast(band.ink, band.bg), "ink on band").toBeGreaterThanOrEqual(4.5);
  expect(contrast(band.muted, band.bg), "muted text on band").toBeGreaterThanOrEqual(4.5);
  expect(contrast(band.accent, band.bg), "accent on band").toBeGreaterThanOrEqual(3);
  const art = mix(band.ink, band.bg, BAND_ART_SHARE);
  expect(contrast(band.ink, art), "ink on band artwork").toBeGreaterThanOrEqual(4.5);
  expect(contrast(band.muted, art), "muted text on band artwork").toBeGreaterThanOrEqual(4.5);
}

describe("club registry", () => {
  it("has a club for every club in the covered leagues, and only those", () => {
    const expected = COVERED.flatMap((id) => SEASON.leagues[id]!.map((name) => `${id}/${name}`)).sort();
    const actual = CLUBS.map((c) => `${c.leagueId}/${c.name}`).sort();
    expect(actual).toEqual(expected);
  });

  it.each(CLUBS.map((c) => [c.slug, c] as const))("%s: slug, league, short name and colours", (_, club) => {
    expect(slugMatchesName(club), `slug should be "${teamSlug(club.name)}"`).toBe(true);
    expect(club.slug).toMatch(SLUG_PATTERN);
    expect(LEAGUES.some((l) => l.id === club.leagueId)).toBe(true);
    expect(club.short).toMatch(/^[A-Z]{3}$/);
    expect(club.founded).toBeGreaterThan(1850);
    expect(club.founded).toBeLessThanOrEqual(new Date().getFullYear());
    for (const { hex } of club.colours) expect(hex).toMatch(/^#[0-9a-f]{3}([0-9a-f]{3})?$/);
    expect(club.inspiration.length).toBeGreaterThan(40);
    expect(club.looks.full.length).toBeGreaterThan(40);
    expect(club.looks.small.length).toBeGreaterThan(10);
  });

  it("has unique slugs, and unique short names within each league", () => {
    expect(new Set(CLUBS.map((c) => c.slug)).size).toBe(CLUBS.length);
    for (const league of LEAGUES) {
      const shorts = CLUBS.filter((c) => c.leagueId === league.id).map((c) => c.short);
      expect(new Set(shorts).size, league.id).toBe(shorts.length);
    }
  });

  it.each(CLUBS.map((c) => [c.slug, c] as const))("%s: band colours pass contrast", (_, club) => {
    checkBand(club.band);
  });

  it("gives every design that may look close to an official badge at least one alternative", () => {
    const missing = CLUBS.filter(
      (c) => c.resemblance.level === "high" && (c.alternatives ?? []).length === 0,
    );
    expect(missing.map((c) => c.slug)).toEqual([]);
    for (const club of CLUBS) {
      expect(club.resemblance.note.length, club.slug).toBeGreaterThan(30);
      for (const alt of club.alternatives ?? []) {
        expect(alt.note.length, `${club.slug}: ${alt.title}`).toBeGreaterThan(30);
        expect(alt.looks.full.length).toBeGreaterThan(30);
        expect(() => renderCrest(alt.full) + renderCrest(alt.small)).not.toThrow();
      }
    }
  });

  it("finds a club by slug, and nothing for a club with no entry", () => {
    expect(clubIdentity("arsenal")?.name).toBe("Arsenal");
    expect(clubIdentity("hamburger-sv")).toBeUndefined();
  });
});

describe("league identities", () => {
  it("has one for each league, under the league's own slug", () => {
    expect(LEAGUE_IDENTITIES.map((l) => [l.leagueId, l.slug])).toEqual(LEAGUES.map((l) => [l.id, l.slug]));
    expect(new Set(LEAGUE_IDENTITIES.map((l) => l.code)).size).toBe(LEAGUES.length);
  });

  it.each(LEAGUE_IDENTITIES.map((l) => [l.slug, l] as const))(
    "%s: band colours pass contrast",
    (_, league) => {
      checkBand(league.band);
      // The initials are white on the tile.
      expect(contrast("#fff", league.ground)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("generated files", () => {
  const files = identityFiles();

  it("are exactly what the designs draw (run node scripts/make-crests.mjs after a change)", () => {
    for (const [path, text] of files) expect(readFileSync(resolve(path), "utf8"), path).toBe(text);
  });

  it("include nothing the registry doesn't make", () => {
    for (const dir of ["src/identity/crests", "src/identity/marks"]) {
      for (const name of readdirSync(resolve(dir)))
        expect(files.has(`${dir}/${name}`), `${dir}/${name}`).toBe(true);
    }
  });

  const svgs = [...files].filter(([path]) => path.endsWith(".svg"));

  it.each(svgs.map(([path, text]) => [path, text]))(
    "%s is a safe, self-contained SVG within budget",
    (path, text) => {
      expect(
        text.startsWith(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">',
        ),
      ).toBe(true);
      // Nothing that runs, loads or styles from outside the file.
      expect(text).not.toMatch(/<script|<style|style=|<foreignObject|<image|href=|url\((?!#)|\son\w+=/i);
      // Only the file's own clip id, which carries the slug, so inline copies never clash.
      for (const [, id] of text.matchAll(/id="([^"]+)"/g)) expect(id).toMatch(/^(c|m)-[a-z0-9-]+$/);
      const budget = path.includes("/marks/") ? 2048 : path.endsWith("-small.svg") ? 3072 : 10240;
      expect(Buffer.byteLength(text), "bytes").toBeLessThanOrEqual(budget);
    },
  );

  it.each(svgs.filter(([p]) => p.includes("/crests/")).map(([p, t]) => [p, t]))(
    "%s has the white keyline and at least one symbol",
    (_, text) => {
      expect(text).toContain('stroke="#fff" stroke-width="5"');
      // A small crest keeps an identifying symbol, not just a coloured shield.
      expect(text).toMatch(/<g transform="translate\(/);
    },
  );

  it("has a club rule and a league rule in the stylesheet, and High Contrast overrides both", () => {
    const css = files.get("src/styles/identity.css")!;
    for (const club of CLUBS) expect(css).toContain(`[data-club="${club.slug}"] {`);
    for (const league of LEAGUE_IDENTITIES) expect(css).toContain(`[data-league="${league.slug}"] {`);
    expect(css).toContain('[data-theme="contrast"] :is([data-club], [data-league]) {');
  });
});

describe("the fallback crest", () => {
  it.each([
    ["Hamburger SV", "HAM"],
    ["Paris FC", "PAR"],
    ["Borussia Mönchengladbach", "BM"],
    ["1. FC Köln", "KOL"],
    ["Mainz 05", "MAI"],
    ["Brighton & Hove Albion", "BHA"],
    ["Deportivo La Coruña", "DLC"],
    ["SC", "?"],
  ])("%s -> %s", (name, letters) => {
    expect(initials(name)).toBe(letters);
  });

  it("is drawn for every club in the uncovered leagues, in both sizes", () => {
    for (const [id, names] of Object.entries(SEASON.leagues)) {
      if (COVERED.includes(id)) continue;
      for (const name of names) {
        for (const size of ["full", "small"] as const) {
          const svg = renderCrest(fallbackDesign(name, size), `c-fallback-${teamSlug(name)}`);
          expect(svg).toContain(`clipPath id="c-fallback-${teamSlug(name)}"`);
          expect(svg).toContain('stroke-dasharray="5 4"');
        }
      }
    }
  });
});

describe("assets", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the small crest at 24 px and below and the full one above (one threshold everywhere)", () => {
    expect(variantFor(16)).toBe("small");
    expect(variantFor(24)).toBe("small");
    expect(variantFor(25)).toBe("full");
    expect(variantFor(120)).toBe("full");
  });

  it("returns a file for a club with a crest", () => {
    const full = crestSource("arsenal", "Arsenal", "full");
    const small = crestSource("arsenal", "Arsenal", "small");
    expect(full.kind).toBe("file");
    expect(small.kind).toBe("file");
    expect(full.kind === "file" && small.kind === "file" && full.src !== small.src).toBe(true);
  });

  it("returns the fallback crest and warns once for a club with none, without throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = crestSource("new-club-fc", "New Club FC", "small");
    crestSource("new-club-fc", "New Club FC", "full");
    expect(first.kind).toBe("fallback");
    expect(first.kind === "fallback" && first.svg).toContain("c-fallback-new-club-fc");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('no crest for "New Club FC"');
  });

  it("writes an inline crest at the asked size, hidden or labelled", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"></svg>';
    expect(svgElement(svg, 48, "crest")).toBe(
      '<svg class="crest" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="48" height="48"></svg>',
    );
    expect(svgElement(svg, 48, "crest", 'Brighton & "Hove" <Albion> crest')).toContain(
      'role="img" aria-label="Brighton &amp; &quot;Hove&quot; &lt;Albion> crest"',
    );
  });
});

describe("lettering", () => {
  it("turns H and V into lines and maps every point", () => {
    expect(mapPath("M0 0H10V5Z", (x, y) => [x * 2, y + 1])).toBe("M0 1L20 1L20 6Z");
    expect(mapPath("M0 0 10 0 10 10Z", (x, y) => [x, y])).toBe("M0 0L10 0L10 10Z");
  });

  it("sets text at the asked cap height, centred, and fits it to a width", () => {
    const free = lineText("ARSENAL", { x: 60, baseline: 50, cap: 10 });
    expect(free.cap).toBe(10);
    const fitted = lineText("ARSENAL", { x: 60, baseline: 50, cap: 10, maxWidth: free.width / 2 });
    expect(fitted.width).toBeCloseTo(free.width / 2, 5);
    expect(fitted.cap).toBeLessThan(10);
  });

  it("refuses text too small to read, and characters it has no outline for", () => {
    expect(() =>
      lineText("BORUSSIA MÖNCHENGLADBACH", { x: 60, baseline: 50, cap: 10, maxWidth: 20 }),
    ).toThrow(LetteringError);
    expect(() => lineText("ŁÓDŹ", { x: 60, baseline: 50, cap: 10 })).toThrow(/no outline/);
  });

  it("keeps arc text on its circle", () => {
    const set = arcText("1886", { cx: 60, cy: 60, r: 46, cap: 8, side: "bottom" });
    const points = [...set.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    for (const [x, y] of points) {
      const d = Math.hypot(x! - 60, y! - 60);
      expect(d).toBeGreaterThan(46 - 4 - 1);
      expect(d).toBeLessThan(46 + 4 + 1);
      expect(y).toBeGreaterThan(60); // under the centre: the bottom of the ring
    }
  });
});

describe("the review gallery script", () => {
  const script = readFileSync(resolve("scripts/crest-gallery.mjs"), "utf8");

  it("loads nothing from other sites (fonts are embedded)", () => {
    expect(script).not.toMatch(/https?:\/\//);
  });

  it("takes the small-crest threshold from the shared size rule", () => {
    expect(script).toContain('from "../src/identity/sizes.ts"');
    expect(script).toContain("${SMALL_MAX} px");
  });
});
