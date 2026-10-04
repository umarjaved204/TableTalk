// The Content Security Policy only lets a script run if its sha256 hash is
// listed in the page's policy. The theme script is inline, so if its text in
// the built page ever differs from the text that was hashed (an edit, a
// placeholder change, Astro reformatting it), the browser silently blocks it
// and themes stop working. These tests read the BUILT pages of the test
// site (dist-e2e/, built by playwright.config.ts) and
// recompute every hash themselves.
//
// No browser needed: this is plain file reading, so it runs once (in the
// desktop-chrome project), not on every phone.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { headIndex, loadTeamIndex } from "../../src/data/teams.ts";
import { buildThemeScript, readSources } from "../../src/scripts/theme-script.ts";
import { E2E_DATA_DIR, E2E_OUT_DIR } from "./site.ts";

const DIST = resolve(E2E_OUT_DIR);

/** Every .html file in dist/, as paths relative to dist/. */
function builtPages(dir = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return builtPages(path);
    return entry.name.endsWith(".html") ? [relative(DIST, path)] : [];
  });
}

function sha256(text: string): string {
  return `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}`;
}

/** The hashes listed in the page's script-src directive. */
function allowedScriptHashes(html: string): string[] {
  const policy = /<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(html)?.[1];
  if (!policy) throw new Error("no Content-Security-Policy <meta> tag");
  const scriptSrc = policy.split(";").find((d) => d.trim().startsWith("script-src"));
  if (!scriptSrc) throw new Error("the policy has no script-src directive");
  return [...scriptSrc.matchAll(/'(sha256-[^']+)'/g)].map((m) => m[1]!);
}

/** The text of every inline <script> that runs (no src attribute, and not a
 *  data block such as <script type="application/json">, which the browser
 *  never runs and the policy doesn't apply to). */
function inlineScripts(html: string): string[] {
  return [
    ...html.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*\stype="application\/json")[^>]*>([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]!);
}

// Rebuilt here from the source files and the test site's data (not taken
// from astro.config.mjs), so a mismatch between the two can't hide.
function themeScript(): string {
  process.env["TABLETALK_DATA_DIR"] = resolve(E2E_DATA_DIR);
  return buildThemeScript(readSources(), headIndex(loadTeamIndex()));
}

// The pages are listed inside each test, not when this file loads: Playwright
// loads test files before the webServer has built the test site.
function pages(): { page: string; html: string; allowed: string[] }[] {
  const list = existsSync(DIST) ? builtPages() : [];
  expect(list.length, `no built pages in ${E2E_OUT_DIR}/`).toBeGreaterThan(0);
  return list.map((page) => {
    const html = readFileSync(join(DIST, page), "utf8");
    return { page, html, allowed: allowedScriptHashes(html) };
  });
}

test("CSP: on every page, the early script is exactly what the sources build, and its hash is allowed", () => {
  const script = themeScript();
  for (const { page, html, allowed } of pages()) {
    expect(inlineScripts(html), `${page}: early script missing or changed`).toContain(script);
    expect(allowed, page).toContain(sha256(script));
  }
});

test("CSP: on every page, every inline script's hash is in the policy", () => {
  for (const { page, html, allowed } of pages()) {
    const blocked = inlineScripts(html).filter((script) => !allowed.includes(sha256(script)));
    expect(
      blocked.map((s) => s.slice(0, 80)),
      `${page}: these inline scripts would be blocked`,
    ).toEqual([]);
  }
});
