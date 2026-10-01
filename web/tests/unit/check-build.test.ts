import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBuild } from "../../scripts/check-build.mjs";

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

/** A fake build folder with the given files. */
function build(files: Record<string, string>): string {
  dir = mkdtempSync(join(tmpdir(), "tabletalk-build-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("build check", () => {
  it("a clean build passes", () => {
    const clean = build({
      "index.html": '<link rel="canonical" href="https://tabletalk.example/">',
      "_astro/barlow-condensed-latin-700-normal.abc.woff2": "",
      "_astro/source-sans-3-latin-ext-wght-normal.abc.woff2": "",
    });
    expect(checkBuild(clean)).toEqual([]);
  });

  it("fails on a local address in any page (the old canonical link)", () => {
    const local = build({
      "index.html": '<html>\n<link rel="canonical" href="http://localhost:4321/">',
      "la-liga/index.html": '<meta property="og:url" content="http://127.0.0.1:4321/la-liga/">',
    });
    expect(checkBuild(local)).toEqual([
      'index.html:2: contains "localhost"',
      'la-liga/index.html:1: contains "127.0.0.1"',
    ]);
  });

  it("fails on .woff fallbacks and on Cyrillic, Greek or Vietnamese subsets", () => {
    const fonts = build({
      "_astro/barlow-condensed-latin-700-normal.abc.woff": "",
      "_astro/source-sans-3-cyrillic-wght-normal.abc.woff2": "",
      "_astro/source-sans-3-greek-wght-normal.abc.woff2": "",
      "_astro/source-sans-3-vietnamese-wght-normal.abc.woff2": "",
    });
    expect(checkBuild(fonts)).toHaveLength(4);
  });
});
