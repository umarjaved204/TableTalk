// Builds the inline early script and its CSP hash. The script runs at the
// very start of <body>, before anything is painted, and does two jobs:
//   1. the theme (theme-head.js);
//   2. the favourite team (favourite-core.js + favourite-head.js).
// It is ONE inline script, so the Content Security Policy needs one hash.
//
// The same function is used by layouts/Base.astro (to write the script into
// every page) and astro.config.mjs (to allow exactly that script in the CSP).
// Astro hashes the scripts it bundles itself, but not raw inline ones, so
// this hash has to be supplied.
//
// FILL_SCRIPT is the tiny inline script placed after each pre-built block
// (FavouriteSlot.astro, RaceChart.astro): it copies the favourite's version
// into every block parsed so far, while the page is still loading. Its text
// never changes, so its hash is fixed.
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WEB_ROOT } from "../data/paths.ts";
import { STORAGE_KEY, THEMES } from "../themes.ts";
import { headIndex, loadTeamIndex, type HeadIndex } from "../data/teams.ts";

/** localStorage key for the favourite team (format: see favourite-core.js). */
export const FAV_STORAGE_KEY = "tabletalk-favourite";

export const FILL_SCRIPT = "window.tabletalkFavourite&&window.tabletalkFavourite.fillAll()";

export interface ScriptSources {
  theme: string;
  core: string;
  favourite: string;
}

/** The three source files, read from src/scripts/ (by path from web/, which
 *  also works inside Astro's bundled build, unlike a path relative to this file). */
export function readSources(): ScriptSources {
  // Line endings normalised: Git on Windows may check the files out with CRLF,
  // and the browser's HTML parser turns CRLF into LF before hashing an inline
  // script, so a CR left in would make the CSP hash wrong and block the script.
  const read = (name: string) =>
    readFileSync(join(WEB_ROOT, "src", "scripts", name), "utf8").replaceAll("\r\n", "\n");
  return {
    theme: read("theme-head.js"),
    core: read("favourite-core.js"),
    favourite: read("favourite-head.js"),
  };
}

/** favourite-core.js as plain script text: `export` removed, so its functions
 *  become ordinary local functions inside the wrapper below. */
export function stripExports(source: string): string {
  return source.replace(/^export /gm, "");
}

/**
 * JSON with "<" and every non-ASCII character written as a \uXXXX escape,
 * non-ASCII ("Atlético") so the script's bytes, and so its hash, can't
 * depend on how the page is decoded.
 *
 * The "<" escape does NOT survive into the page: esbuild's minify writes
 * "<" back as a plain "<". esbuild itself writes "</script" as
 * "<\/script", but leaves "<!--" and "<script" as they are, and those two
 * change how the HTML parser reads the rest of an inline script. So
 * buildThemeScript checks the final text instead (UNSAFE_IN_SCRIPT).
 */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** JSON to put inside a <script type="application/json"> data block: only
 *  "<" needs escaping there (so the data can't end the element early). */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", String.raw`\u003c`);
}

/** The three sources joined, readable (not minified), with the placeholders
 *  filled in. The favourite part gets its own function scope, so its helpers
 *  don't become globals on the page. */
export function joinSources(sources: ScriptSources, teams: HeadIndex): string {
  const placeholders: Record<string, string> = {
    __THEME_IDS__: JSON.stringify(THEMES.map((t) => t.id)),
    __STORAGE_KEY__: JSON.stringify(STORAGE_KEY),
    __FAV_KEY__: JSON.stringify(FAV_STORAGE_KEY),
    __TEAM_INDEX__: asciiJson(teams),
  };
  let script = [
    sources.theme.trim(),
    "(function () {",
    stripExports(sources.core).trim(),
    sources.favourite.trim(),
    "})();",
  ].join("\n");
  for (const [placeholder, value] of Object.entries(placeholders)) {
    script = script.replaceAll(placeholder, () => value);
  }
  // A placeholder left behind would break every page, so stop the build.
  const leftover = /__[A-Z_]+__/.exec(script);
  if (leftover) throw new Error(`early script: unknown placeholder ${leftover[0]}`);
  return script;
}

/**
 * Text that must never appear in an inline script: "</script" ends the
 * element, and "<!--" or "<script" can make the HTML parser run past the
 * real "</script>" and swallow the rest of the page. The CSP hash would then
 * no longer match, so the early script would be blocked on every page
 * (themes and favourites stop working). Checked after minifying.
 */
export const UNSAFE_IN_SCRIPT = /<!--|<script|<\/script/i;

/**
 * The script as it goes into every page: minified by esbuild (comments,
 * spaces and long local names removed: about half the size), and plain ASCII
 * (esbuild writes any other character as an escape), so its bytes, and so
 * its CSP hash, can't depend on how the page is decoded. The readable source
 * stays in src/scripts/. Stops the build if a team name (or anything else)
 * puts UNSAFE_IN_SCRIPT text into it.
 */
export function buildThemeScript(sources: ScriptSources, teams: HeadIndex): string {
  const script = transformSync(joinSources(sources, teams), {
    minify: true,
    charset: "ascii",
    target: "es2020",
    legalComments: "none",
  }).code.trim();
  const wide = /[^\n\x20-\x7e]/.exec(script);
  if (wide) throw new Error(`early script: unexpected character U+${wide[0].charCodeAt(0).toString(16)}`);
  const unsafe = UNSAFE_IN_SCRIPT.exec(script);
  if (unsafe) {
    throw new Error(
      `early script: contains "${unsafe[0]}", which would break the inline <script> on every page (a team name in the data?)`,
    );
  }
  return script;
}

let cached: string | null = null;

/** The early script for this build: the source files plus this build's team list. */
export function earlyScript(): string {
  cached ??= buildThemeScript(readSources(), headIndex(loadTeamIndex()));
  return cached;
}

export function cspHash(script: string): `sha256-${string}` {
  return `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;
}
