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
import { buildThemeScript } from "../../src/scripts/theme-script.ts";
import { E2E_OUT_DIR } from "./site.ts";

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

/** The text of every inline <script> (one without a src attribute). */
function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
}

const themeScript = buildThemeScript(readFileSync(resolve("src/scripts/theme-head.js"), "utf8"));

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

test("CSP: on every page, the theme script is exactly theme-head.js, and its hash is allowed", () => {
  for (const { page, html, allowed } of pages()) {
    // Recomputed here from the source file, not taken from astro.config.mjs.
    expect(inlineScripts(html), `${page}: theme script missing or changed`).toContain(themeScript);
    expect(allowed, page).toContain(sha256(themeScript));
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
