import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkBuild, headersFor, parseHeaders } from "../../scripts/check-build.mjs";

/** The real public/_headers, which Astro copies into every build. */
const HEADERS = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

/** A fake build folder with the given files (and the real _headers unless one is given; null leaves it out). */
function build(files: Record<string, string | null>): string {
  dir = mkdtempSync(join(tmpdir(), "tabletalk-build-"));
  for (const [name, content] of Object.entries({ _headers: HEADERS, ...files })) {
    if (content === null) continue;
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

  it("fails when _headers is missing from the build", () => {
    expect(checkBuild(build({ "index.html": "", _headers: null }))).toEqual([
      "_headers: missing (public/_headers must be copied into the build)",
    ]);
  });

  it("fails when a planned header line is missing", () => {
    const problems = checkBuild(
      build({ "index.html": "", _headers: HEADERS.replace(/^ {2}X-Frame-Options: DENY\r?\n/m, "") }),
    );
    expect(problems).toContain('_headers: rule /* is missing "X-Frame-Options: DENY"');
    expect(problems).toContain('_headers: / gets X-Frame-Options "0 values: ", expected "DENY"');
  });

  it("fails when an /_astro/ file would get two Cache-Control values (no detach)", () => {
    const problems = checkBuild(
      build({ "_astro/site.abc.css": "", _headers: HEADERS.replace(/^ {2}! Cache-Control\r?\n/m, "") }),
    );
    expect(problems).toContain('_headers: rule /_astro/* is missing "! Cache-Control"');
    expect(problems).toContain(
      '_headers: /_astro/site.abc.css gets Cache-Control "2 values: no-cache + public, max-age=31536000, immutable", expected "public, max-age=31536000, immutable"',
    );
  });

  it("fails on a header line without a colon, and on one before any rule", () => {
    const broken = `  X-Early: yes\n${HEADERS.replace("X-Frame-Options: DENY", "X-Frame-Options DENY")}`;
    const problems = checkBuild(build({ "index.html": "", _headers: broken }));
    expect(problems).toContain('_headers: not "Name: value" or "! Name", in before any rule: "X-Early: yes"');
    expect(problems).toContain('_headers: not "Name: value" or "! Name", in /*: "X-Frame-Options DENY"');
  });

  it("accepts the later one-year HSTS and refuses anything else", () => {
    const year = HEADERS.replace("max-age=86400", "max-age=31536000");
    expect(checkBuild(build({ "index.html": "", _headers: year }))).toEqual([]);
    const sub = HEADERS.replace("max-age=86400", "max-age=86400; includeSubDomains");
    expect(checkBuild(build({ "index.html": "", _headers: sub }))).toHaveLength(3);
  });

  it("gives pages, the 404 page and icons the page cache, /_astro/ files the immutable one", () => {
    const { rules, malformed } = parseHeaders(HEADERS);
    expect(malformed).toEqual([]);
    const cache = (path: string) => headersFor(rules, path).get("cache-control");
    for (const path of ["/", "/premier-league/arsenal/", "/no-such-page/", "/favicon.svg", "/sitemap.xml"])
      expect(cache(path)).toEqual(["no-cache"]);
    expect(cache("/_astro/source-sans-3-latin-wght-normal.abc.woff2")).toEqual([
      "public, max-age=31536000, immutable",
    ]);
  });
});
