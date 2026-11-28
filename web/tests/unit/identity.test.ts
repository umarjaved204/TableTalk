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
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAGUES } from "../../src/data/leagues.ts";
import { SLUG_PATTERN, teamSlug } from "../../src/data/teams.ts";
import {
  crestInline,
  crestSource,
  leagueMark,
  leagueMarkUrl,
  svgElement,
  variantFor,
} from "../../src/identity/assets.ts";
import { DARK_THEMES, identityFiles } from "../../src/identity/build.ts";
import { CLUBS, clubIdentity, slugMatchesName } from "../../src/identity/clubs/index.ts";
import { fallbackDesign, initials, renderCrest } from "../../src/identity/crest.ts";
import { LEAGUE_IDENTITIES } from "../../src/identity/leagues.ts";
import {
  SUPPLIED_CREST_BUDGET,
  SUPPLIED_CREST_LABEL,
  SUPPLIED_CRESTS,
  SUPPLIED_LABEL,
  SUPPLIED_MARKS,
  SUPPLIED_RASTER_BUDGET,
} from "../../src/identity/supplied.ts";
import { LetteringError, arcText, lineText, mapPath } from "../../src/identity/lettering.ts";
import type { BandColours } from "../../src/identity/types.ts";

/** Leagues whose crests are drawn so far; the rest follow league by league. */
const COVERED = ["premier_league", "la_liga", "bundesliga"];

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
    expect(clubIdentity("ac-milan")).toBeUndefined();
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

  it("leave every approved crest exactly as approved", () => {
    // A shared change (lettering, shapes, symbols) must not alter an
    // approved crest. A deliberate, re-approved revision updates the fixture.
    const approved = JSON.parse(readFileSync(resolve("tests/fixtures/approved-crests.json"), "utf8")) as {
      files: Record<string, string>;
    };
    for (const [name, hash] of Object.entries(approved.files)) {
      // Supplied artwork is fingerprinted as the file's bytes; TableTalk's
      // own crests as the text the designs draw. Supplied artwork is private
      // (kept out of the public repository until it is cleared), so it is
      // checked wherever it is present: on the owner's machine, not in CI.
      if (name.startsWith("supplied/") && !existsSync(resolve("src/identity", name))) continue;
      const content = name.startsWith("supplied/")
        ? readFileSync(resolve("src/identity", name))
        : files.get(`src/identity/crests/${name}`);
      expect(content, name).toBeDefined();
      expect(
        createHash("sha256")
          .update(content ?? "")
          .digest("hex"),
        name,
      ).toBe(hash);
    }
  });

  it("fingerprint every crest of every finally approved league, full and small", () => {
    // Add a league here, and its crests to the fixture, once its artwork is
    // finally approved. Leagues still in review are left out on purpose.
    const APPROVED_LEAGUES = ["premier_league", "la_liga", "bundesliga"];
    const approved = JSON.parse(readFileSync(resolve("tests/fixtures/approved-crests.json"), "utf8")) as {
      files: Record<string, string>;
    };
    const clubs = CLUBS.filter((c) => APPROVED_LEAGUES.includes(c.leagueId));
    expect(clubs).toHaveLength(58);
    for (const club of clubs)
      for (const name of [`${club.slug}.svg`, `${club.slug}-small.svg`])
        expect(approved.files[name], name).toMatch(/^[0-9a-f]{64}$/);
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

  // A crest whose identity is its lettering (BVB, S04, the W, the 05) needs no
  // symbol: its composition says so. A crest whose identity is a pattern of
  // its own is listed here, with the reason. Every other crest needs one.
  const LETTERING = /monogram|letter|numerals|lettering/;
  const PATTERN_IS_THE_EMBLEM: Record<string, string> = {
    "hamburger-sv": "the black and white quartered diamond, the Raute, is the club's emblem",
  };
  const clubOf = (path: string) =>
    CLUBS.find((c) => path.endsWith(`/${c.slug}.svg`) || path.endsWith(`/${c.slug}-small.svg`));

  it.each(svgs.filter(([p]) => p.includes("/crests/")).map(([p, t]) => [p, t]))(
    "%s has the white keyline and an identifying symbol, lettering or emblem",
    (path, text) => {
      expect(text).toContain('stroke="#fff" stroke-width="5"');
      // A small crest keeps an identifying element, not just a coloured shield.
      const club = clubOf(path);
      if (club && (LETTERING.test(club.composition ?? "") || PATTERN_IS_THE_EMBLEM[club.slug])) {
        // Lettering crests must actually carry more than the shield's own paths.
        expect(text.match(/<path /g)?.length ?? 0, path).toBeGreaterThan(3);
        return;
      }
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

describe("supplied club crests", () => {
  const dir = "src/identity/supplied/crests";
  const names = readdirSync(resolve(dir)).filter((n) => n !== "README.md");
  const approved = JSON.parse(readFileSync(resolve("tests/fixtures/approved-crests.json"), "utf8")) as {
    files: Record<string, string>;
  };

  it("are kept out of the public repository until cleared", () => {
    const ignore = readFileSync(resolve(".gitignore"), "utf8");
    expect(ignore).toContain("src/identity/supplied/crests/*.webp");
    expect(ignore).toContain("src/identity/supplied/marks/*.webp");
  });

  it("are listed in supplied.ts, labelled as such and never as official", () => {
    // Every file present is listed. The files are private, so a public
    // checkout has none and those clubs show TableTalk's own crests.
    for (const n of names) expect(Object.keys(SUPPLIED_CRESTS), n).toContain(n.replace(/\.\w+$/, ""));
    for (const [slug, crest] of Object.entries(SUPPLIED_CRESTS)) {
      expect(clubIdentity(slug), slug).toBeDefined();
      expect(crest.label, slug).toBe(SUPPLIED_CREST_LABEL);
      expect(crest.provenance, slug).toContain("Not an official or licensed file");
      expect(crest.resemblance.note, slug).toContain("not automatically legally cleared");
    }
  });

  it.each(names.map((n) => [n]))(
    "%s is a 240 px or larger square WebP within its budget, and fingerprinted",
    (name) => {
      const bytes = readFileSync(resolve(dir, name));
      expect(bytes.length, "bytes").toBeLessThanOrEqual(SUPPLIED_CREST_BUDGET);
      expect(bytes.subarray(8, 16).toString("latin1")).toBe("WEBPVP8X");
      const width = bytes.readUIntLE(24, 3) + 1;
      expect(bytes.readUIntLE(27, 3) + 1).toBe(width);
      expect(width).toBeGreaterThanOrEqual(240);
      expect(approved.files[`supplied/crests/${name}`], name).toMatch(/^[0-9a-f]{64}$/);
    },
  );

  it("take the place of the full crest only, where present; the small crest stays TableTalk's own", () => {
    for (const slug of Object.keys(SUPPLIED_CRESTS)) {
      const club = clubIdentity(slug);
      const full = crestSource(slug, club?.name ?? slug, "full");
      const small = crestSource(slug, club?.name ?? slug, "small");
      if (!names.includes(`${slug}.webp`)) {
        // Without the private file, the club shows TableTalk's own crest.
        expect(full.kind === "file" && full.src, slug).not.toMatch(/supplied/);
        continue;
      }
      expect(full.kind === "file" && full.src, slug).toMatch(/supplied\/crests|^data:image\/webp/);
      expect(small.kind === "file" && small.src, slug).not.toMatch(/supplied/);
      expect(crestInline(slug, club?.name ?? slug), slug).toBeUndefined();
    }
  });
});

describe("league marks from files", () => {
  const IMAGE = /^([a-z0-9-]+?)(-dark)?\.(svg|png|webp)$/;
  const images = (dir: string) => readdirSync(resolve(dir)).filter((n) => n !== "README.md");
  const supplied = images("src/identity/supplied/marks");
  const licensed = images("src/identity/licensed/marks");
  const slugs = new Set(LEAGUE_IDENTITIES.map((l) => l.slug));

  it("are named after a league and are images the site can serve", () => {
    for (const name of [...supplied, ...licensed]) {
      const m = IMAGE.exec(name);
      expect(m, name).not.toBeNull();
      expect(slugs.has(m?.[1] ?? ""), name).toBe(true);
    }
  });

  it("supplied artwork is listed in supplied.ts, labelled as such and never as official", () => {
    const files = new Set(supplied.map((n) => n.replace(/\.\w+$/, "")));
    // Every file present is listed. The files are private, so a public
    // checkout has none and its leagues show TableTalk's own marks.
    for (const f of files) expect(Object.keys(SUPPLIED_MARKS), f).toContain(f.replace(/-dark$/, ""));
    for (const [slug, art] of Object.entries(SUPPLIED_MARKS)) {
      expect(art.label, slug).toBe(SUPPLIED_LABEL);
      expect(art.provenance, slug).toContain("Not an official or licensed file");
      if (files.has(slug)) expect(files.has(`${slug}-dark`), `${slug}-dark`).toBe(art.darkVariant);
      // Resemblance is recorded, and close artwork says it isn't cleared.
      expect(art.resemblance.note.length, slug).toBeGreaterThan(40);
      if (art.resemblance.level === "high")
        expect(art.resemblance.note, slug).toContain("not automatically legally cleared");
      expect(LEAGUE_IDENTITIES.find((l) => l.slug === slug)?.supplied, slug).toBe(art);
    }
  });

  it.each(supplied.map((n) => [n]))("supplied %s is a 192 px or larger WebP within its budget", (name) => {
    const bytes = readFileSync(resolve("src/identity/supplied/marks", name));
    expect(bytes.length, "bytes").toBeLessThanOrEqual(SUPPLIED_RASTER_BUDGET);
    // RIFF....WEBPVP8X: the extended format, which carries the alpha channel
    // and the canvas size (24-bit, minus one) at bytes 24 and 27.
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(bytes.subarray(8, 16).toString("latin1")).toBe("WEBPVP8X");
    const width = bytes.readUIntLE(24, 3) + 1;
    const height = bytes.readUIntLE(27, 3) + 1;
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(192);
  });

  it("are picked licensed first, then supplied, then TableTalk's own mark", () => {
    const has = (names: string[], slug: string, suffix = "") =>
      names.some((n) => n.replace(/\.\w+$/, "") === `${slug}${suffix}`);
    for (const l of LEAGUE_IDENTITIES) {
      const mark = leagueMark(l.slug);
      const expected = has(licensed, l.slug) ? "licensed" : has(supplied, l.slug) ? "supplied" : "generated";
      expect(mark?.source, l.slug).toBe(expected);
      const folder = expected === "licensed" ? licensed : supplied;
      expect(mark?.darkSrc !== undefined, `${l.slug} dark`).toBe(
        expected !== "generated" && has(folder, l.slug, "-dark"),
      );
      expect(leagueMarkUrl(l.slug), l.slug).toBe(mark?.src);
    }
    expect(leagueMark("serie-a")?.source).toBe("generated");
    if (has(supplied, "ligue-1")) expect(leagueMark("ligue-1")?.darkSrc).toBeDefined();
  });

  it("switch to the dark variant on exactly the dark themes", () => {
    const dir = resolve("src/styles/themes");
    const dark = readdirSync(dir)
      .filter((f) => /color-scheme:\s*dark/.test(readFileSync(resolve(dir, f), "utf8")))
      .map((f) => f.replace(/\.css$/, ""))
      .sort();
    expect([...DARK_THEMES].sort()).toEqual(dark);
    const css = readFileSync(resolve("src/styles/identity.css"), "utf8");
    const rule = (sel: string) =>
      [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) => m[1]?.trim().endsWith(sel))?.[1] ?? "";
    // Hidden by default (light themes, and no data-theme without JavaScript)…
    expect(css).toContain(".league-mark--dark {\n  display: none;\n}");
    // …and swapped in on every dark theme, nowhere else.
    const hidesLight = [...rule(".league-mark--light").matchAll(/data-theme="([\w-]+)"/g)].map((m) => m[1]);
    expect(hidesLight.sort()).toEqual(dark);
    const shown = [...css.matchAll(/([^{}]+)\{\s*display: inline;/g)].map((m) => m[1] ?? "");
    expect(shown).toHaveLength(1);
    expect([...(shown[0] ?? "").matchAll(/data-theme="([\w-]+)"/g)].map((m) => m[1]).sort()).toEqual(dark);
  });
});

describe("league concepts", () => {
  it("uses the competition-inspired mark and keeps the cultural one beside it, all rated", () => {
    for (const league of LEAGUE_IDENTITIES) {
      expect(league.approach, league.slug).toBe("competition");
      expect(league.resemblance.note.length, league.slug).toBeGreaterThan(30);
      expect(
        league.alternatives.some((c) => c.approach === "cultural"),
        league.slug,
      ).toBe(true);
      for (const c of league.alternatives) {
        expect(c.resemblance.note.length, `${league.slug}: ${c.title}`).toBeGreaterThan(30);
        expect(c.looks.length).toBeGreaterThan(30);
        expect(c.inspiration.length).toBeGreaterThan(30);
      }
    }
  });

  it("offers a modern brand-inspired concept for the four leagues in this round", () => {
    const withBrand = LEAGUE_IDENTITIES.filter((l) => l.alternatives.some((c) => c.approach === "brand"));
    expect(withBrand.map((l) => l.leagueId).sort()).toEqual([
      "bundesliga",
      "la_liga",
      "ligue_1",
      "premier_league",
    ]);
  });

  it.each(
    LEAGUE_IDENTITIES.flatMap((l) =>
      l.alternatives.map(
        (c, n) => [`${l.slug}: ${c.title}`, renderCrest(c.mark, `m-${l.slug}-a${n}`)] as const,
      ),
    ),
  )("%s is a safe, self-contained SVG within the 2 KB mark budget", (_, text) => {
    expect(text).not.toMatch(/<script|<style|style=|<foreignObject|<image|href=|url\((?!#)|\son\w+=/i);
    for (const [, id] of text.matchAll(/id="([^"]+)"/g)) expect(id).toMatch(/^(c|m)-[a-z0-9-]+$/);
    expect(Buffer.byteLength(text), "bytes").toBeLessThanOrEqual(2048);
  });
});
