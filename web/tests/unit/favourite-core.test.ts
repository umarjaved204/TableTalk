// The favourite team's logic (src/scripts/favourite-core.js): what is stored,
// how a stored value or a personal link is read, and what is never trusted.
// The same file is copied into the early script on every page, so these
// tests check the code that runs in the browser.
import { describe, expect, it } from "vitest";
import {
  FAV_VERSION,
  favouriteCss,
  findTeam,
  isSlug,
  linkOffer,
  makeIndex,
  parseStored,
  readLink,
  resolveFavourite,
  serialize,
  withoutTeamParam,
  STALE_HOURS,
  ageText,
  staleCss,
} from "../../src/scripts/favourite-core.js";
import { STALE_AFTER_HOURS, formatAge } from "../../src/format/time.ts";

const index = makeIndex({
  leagues: [
    [
      "premier_league",
      "Premier League",
      [
        ["arsenal", "Arsenal"],
        ["chelsea", "Chelsea"],
        ["brighton-and-hove-albion", "Brighton & Hove Albion"],
      ],
    ],
    ["bundesliga", "Bundesliga", [["1-fc-koln", "1. FC Köln"]]],
  ],
  names: [
    ["premier_league", "the Premier League"],
    ["bundesliga", "the Bundesliga"],
    ["la_liga", "La Liga"],
  ],
  unavailable: ["la_liga"],
  renames: { "old-arsenal": "arsenal" },
});

const stored = (value: unknown) => JSON.stringify(value);

describe("reading what is stored", () => {
  it.each([
    ["nothing", null],
    ["an empty string", ""],
    ["not JSON", "{nope"],
    ["JSON null", "null"],
    ["a number", "42"],
    ["an array", "[1]"],
    ["no version", stored({ team: "arsenal" })],
    ["version 0", stored({ v: 0, team: "arsenal" })],
    ["version as text", stored({ v: "1", team: "arsenal" })],
    ["a fractional version", stored({ v: 1.5, team: "arsenal" })],
  ])("%s counts as no favourite", (_, raw) => {
    expect(parseStored(raw)).toEqual({ kind: "none" });
  });

  it("a newer version is recognised and left alone (an old cached page must not destroy it)", () => {
    expect(parseStored(stored({ v: 2, anything: true }))).toEqual({ kind: "newer" });
    expect(resolveFavourite({ kind: "newer" }, index)).toEqual({ state: "newer" });
  });

  it("reads a valid value", () => {
    expect(
      parseStored(serialize({ slug: "arsenal", name: "Arsenal", league: "premier_league" }, true)),
    ).toEqual({
      kind: "saved",
      team: "arsenal",
      name: "Arsenal",
      league: "premier_league",
      dismissed: true,
    });
  });

  it("drops a bad slug, name or league on its own", () => {
    const parsed = parseStored(
      stored({ v: 1, team: "Arsenal FC!", name: "x".repeat(61), league: "Premier League", prompt: "yes" }),
    );
    expect(parsed).toEqual({ kind: "saved", team: null, name: null, league: null, dismissed: false });
  });

  it("stores the version, slug, name and league, and 'Not now'", () => {
    expect(
      JSON.parse(serialize({ slug: "arsenal", name: "Arsenal", league: "premier_league" }, false)),
    ).toEqual({
      v: FAV_VERSION,
      team: "arsenal",
      name: "Arsenal",
      league: "premier_league",
    });
    expect(JSON.parse(serialize(null, true))).toEqual({ v: FAV_VERSION, team: null, prompt: "dismissed" });
  });
});

describe("where the visitor stands", () => {
  const saved = (team: string | null, league: string | null = null, dismissed = false) =>
    ({ kind: "saved", team, name: "Stored Name", league, dismissed }) as const;

  it("no favourite: the prompt, unless dismissed", () => {
    expect(resolveFavourite({ kind: "none" }, index)).toEqual({ state: "none" });
    expect(resolveFavourite(saved(null), index)).toEqual({ state: "none" });
    expect(resolveFavourite(saved(null, null, true), index)).toEqual({ state: "dismissed" });
  });

  it("a team in this season's data: chosen, with the name from the data, not from storage", () => {
    expect(resolveFavourite(saved("arsenal", "la_liga"), index)).toEqual({
      state: "chosen",
      team: "arsenal",
      name: "Arsenal",
      league: "premier_league",
    });
  });

  it("follows a rename", () => {
    expect(resolveFavourite(saved("old-arsenal"), index)).toMatchObject({ state: "chosen", team: "arsenal" });
  });

  it("a team no longer covered (e.g. relegated): gone, keeping the stored name and league", () => {
    expect(resolveFavourite(saved("hull-city", "premier_league"), index)).toEqual({
      state: "gone",
      team: "hull-city",
      name: "Stored Name",
      league: "premier_league",
    });
  });

  it("a team whose league has no data this build: paused, not gone", () => {
    expect(resolveFavourite(saved("barcelona", "la_liga"), index)).toMatchObject({
      state: "paused",
      league: "la_liga",
    });
  });
});

describe("personal links (?team=...)", () => {
  it("reads exactly one well-formed value", () => {
    expect(readLink("")).toBeNull();
    expect(readLink("?other=1")).toBeNull();
    expect(readLink("?team=arsenal")).toEqual({ slug: "arsenal" });
    expect(readLink("?team=arsenal&team=chelsea")).toEqual({ slug: null });
    expect(readLink("?team=")).toEqual({ slug: null });
    expect(readLink(`?team=${"a".repeat(61)}`)).toEqual({ slug: null });
  });

  // Attempts to get text from the address bar into the page. Each must be
  // rejected before it is compared with anything, and none is ever shown.
  it.each([
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "%253Cscript%253E",
    "javascript:alert(1)",
    "arsenal<b>",
    "Arsenal",
    "arsenal ",
    "arsenal\n",
    "../../etc/passwd",
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "x".repeat(10_000),
  ])("rejects %j", (payload) => {
    const link = readLink(`?team=${encodeURIComponent(payload)}`);
    const offer = linkOffer(link, { state: "none" }, index);
    expect(offer).toEqual({ kind: "unknown" });
    expect(JSON.stringify(offer)).not.toContain("<");
  });

  it("the lookup can't be fooled by object property names", () => {
    for (const name of ["__proto__", "constructor", "prototype", "valueOf"]) {
      expect(findTeam(index, name)).toBeNull();
    }
    expect(isSlug("__proto__")).toBe(false);
  });

  it("offers, replaces, or says it's already set", () => {
    const link = readLink("?team=chelsea");
    expect(linkOffer(link, { state: "none" }, index)).toEqual({
      kind: "offer",
      team: "chelsea",
      name: "Chelsea",
    });
    expect(
      linkOffer(
        link,
        { state: "gone", team: "hull-city", name: "Hull City", league: "premier_league" },
        index,
      ),
    ).toMatchObject({ kind: "offer" });
    expect(
      linkOffer(link, { state: "chosen", team: "arsenal", name: "Arsenal", league: "premier_league" }, index),
    ).toEqual({
      kind: "replace",
      team: "chelsea",
      name: "Chelsea",
      replacing: "Arsenal",
    });
    expect(
      linkOffer(link, { state: "chosen", team: "chelsea", name: "Chelsea", league: "premier_league" }, index),
    ).toEqual({
      kind: "same",
      team: "chelsea",
      name: "Chelsea",
    });
  });

  it("a team not covered this season is 'unknown' (its name is never repeated from the link)", () => {
    expect(linkOffer(readLink("?team=hull-city"), { state: "none" }, index)).toEqual({ kind: "unknown" });
  });

  it("removes only the team parameter from the address", () => {
    expect(withoutTeamParam("https://x.test/?team=arsenal")).toBe("/");
    expect(withoutTeamParam("https://x.test/premier-league/?a=1&team=arsenal&b=2#table")).toBe(
      "/premier-league/?a=1&b=2#table",
    );
  });
});

describe("the favourite's CSS rule", () => {
  const ids = ["premier_league", "bundesliga", "la_liga", "serie_a", "ligue_1"];

  it("one rule for the team's rows and names, one for its match cards", () => {
    const css = favouriteCss("arsenal", "premier_league", ids);
    expect(css).toContain(':root[data-fav="arsenal"] [data-team="arsenal"]{--fav-mark:inline-block;');
    expect(css).toContain(':root[data-fav="arsenal"] [data-teams~="arsenal"]{--fav-card-bg:var(--fav-tint)}');
  });

  it("moves the league card first and gives every card its width after the move", () => {
    // Ligue 1 is fifth in the switcher; as the favourite's league it becomes first.
    const rules = favouriteCss(null, "ligue_1", ids).split("\n");
    expect(rules).toHaveLength(5);
    expect(rules.find((r) => r.includes('"ligue_1"'))).toMatch(
      /--fav-span-lg:2;--fav-col-md:auto;--fav-order:-1/,
    );
    // Visual order: Ligue 1, PL, BL, La Liga, Serie A: the last two take 3
    // columns at 1024px, and the last is full width at 640px.
    expect(rules.find((r) => r.includes('"la_liga"'))).toContain("--fav-span-lg:3");
    expect(rules.find((r) => r.includes('"serie_a"'))).toContain("--fav-col-md:1/-1");
  });

  it("never stars every team in a league card: the league rule uses its own property", () => {
    for (const rule of favouriteCss(null, "bundesliga", ids).split("\n"))
      expect(rule).not.toContain("--fav-mark:");
  });

  it("writes nothing for a value that isn't a slug or a known league", () => {
    expect(favouriteCss('x"]{}*{color:red', null, ids)).toBe("");
    expect(favouriteCss(null, "not_a_league", ids)).toBe("");
    expect(favouriteCss(null, null, ids)).toBe("");
  });
});

describe("out-of-date numbers, flagged before the first paint (staleCss)", () => {
  const made = "2026-09-28T04:40:00Z";
  const at = (hours: number) => Date.parse(made) + hours * 3_600_000;

  it("nothing until the numbers are more than 30 hours old", () => {
    expect(staleCss([made], at(30))).toBe("");
    expect(staleCss([made], at(30.1))).toContain(`[data-generated="${made}"]`);
  });

  it("the rule shows the warning and says how old the numbers are", () => {
    const css = staleCss([made, "2026-09-29T17:56:40Z"], at(52));
    expect(css).toBe(
      `[data-generated="${made}"]{--stale-show:block;--stale-bg:var(--warn-bg);--stale-fg:var(--warn-text);` +
        `--stale-weight:600;--stale-pad:var(--space-2);--stale-note:" (2 days ago): these numbers may be out of date"}`,
    );
  });

  it("ignores anything that isn't an ISO time (it goes into a CSS selector)", () => {
    expect(staleCss(['x"]{} *{display:none', 42, null], at(100))).toBe("");
    expect(staleCss(undefined, at(100))).toBe("");
  });

  it("says the same as the site's own formatAge, with the same 30-hour limit", () => {
    expect(STALE_HOURS).toBe(STALE_AFTER_HOURS);
    for (const hours of [30.5, 31, 47.4, 47.6, 48, 60, 100, 500])
      expect(ageText(hours)).toBe(formatAge(hours));
  });
});
