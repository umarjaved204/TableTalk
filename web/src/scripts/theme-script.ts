// Builds the inline theme script (theme-head.js with its placeholders filled
// from src/themes.ts) and its CSP hash.
//
// The same function is used by layouts/Base.astro (to write the script into
// every page) and astro.config.mjs (to allow exactly that script in the
// Content Security Policy). Astro hashes the scripts it bundles itself, but
// not raw inline ones, so this hash has to be supplied.
import { createHash } from "node:crypto";
import { STORAGE_KEY, THEMES } from "../themes.ts";

const PLACEHOLDERS: Record<string, string> = {
  __THEME_IDS__: JSON.stringify(THEMES.map((t) => t.id)),
  __STORAGE_KEY__: JSON.stringify(STORAGE_KEY),
};

export function buildThemeScript(source: string): string {
  let script = source;
  for (const [placeholder, value] of Object.entries(PLACEHOLDERS)) {
    script = script.replaceAll(placeholder, value);
  }
  // A placeholder left behind would break the theme on every page, so stop the build.
  const leftover = /__[A-Z_]+__/.exec(script);
  if (leftover) throw new Error(`theme-head.js: unknown placeholder ${leftover[0]}`);
  return script;
}

export function cspHash(script: string): `sha256-${string}` {
  return `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`;
}
