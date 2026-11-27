// The decorative artwork (src/art/artwork.ts): small, hidden from screen
// readers, sized before it loads, and safe under the site's CSP.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ART_SIZE, artSvg, type ArtName, type ArtTone } from "../../src/art/artwork.ts";

const NAMES = Object.keys(ART_SIZE) as ArtName[];
const TONES: ArtTone[] = ["scene", "lines", "band"];
const ART_CSS = readFileSync(resolve("src/styles/art.css"), "utf8");

describe.each(NAMES.map((name) => [name]))("artwork: %s", (name) => {
  const svg = artSvg(name, "scene");

  it("is under 6 KB", () => {
    expect(new TextEncoder().encode(svg).length).toBeLessThan(6 * 1024);
  });

  it("is decorative: aria-hidden, not focusable, no text or title", () => {
    expect(svg).toMatch(/^<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
    expect(svg).not.toMatch(/<(title|desc|text)\b/);
  });

  it("has width and height, so its space is reserved before it is drawn", () => {
    const { width, height } = ART_SIZE[name];
    expect(svg).toContain(`width="${width}" height="${height}"`);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
  });

  it("has no colours, inline styles, scripts, links or ids of its own", () => {
    // Colours come from art.css; style="" would break the CSP; ids would
    // clash when a page shows the same picture twice.
    expect(svg).not.toMatch(/\b(fill|stroke|style|id|href|on\w+)=/);
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it("every shape class it uses is coloured in art.css", () => {
    const classes = new Set(
      [...svg.matchAll(/class="(a-[\w-]+)(?: (a-[\w-]+))?"/g)].flatMap((m) => [m[1], m[2]]),
    );
    classes.delete(undefined);
    for (const cls of classes) expect(ART_CSS, cls).toContain(`.${cls}`);
  });

  it.each(TONES.map((tone) => [tone]))("renders the %s tone", (tone) => {
    expect(artSvg(name, tone)).toContain(`data-tone="${tone}"`);
  });
});
