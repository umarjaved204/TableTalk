// Where a club's crest comes from, at build time. The one place that knows
// about files: ClubCrest and LeagueMark only ask for "the crest of this club
// at this size" and get back an image address, or SVG to write into the page.
//
// Asset-agnostic on purpose. The crests are TableTalk's own drawings today.
// If official crests are licensed later, put each one in src/identity/crests/
// under the same name (<slug>.svg, or .png/.webp at 240 x 240 or larger) and
// nothing else changes: components, pages and layouts stay as they are.
//
// Files are imported through Vite, so they are copied to /_astro/ with a
// content hash in the name and cached for a year (public/_headers). Vite
// would normally write small files into the page as data: addresses instead;
// astro.config.mjs turns that off for this folder so every crest is fetched
// once and then comes from the cache on every page.
import { fallbackDesign, renderCrest } from "./crest.ts";
import type { CrestVariant } from "./sizes.ts";

const URLS = import.meta.glob<string>("./{crests,marks}/*.{svg,png,webp}", {
  query: "?url",
  import: "default",
  eager: true,
});
const RAW = import.meta.glob<string>("./crests/*.svg", { query: "?raw", import: "default", eager: true });

export { SMALL_MAX, variantFor, type CrestVariant } from "./sizes.ts";

export type CrestSource =
  /** A file: shown with <img src>. */
  | { kind: "file"; src: string }
  /** No file: the fallback crest, written into the page. */
  | { kind: "fallback"; svg: string };

const EXTENSIONS = ["svg", "png", "webp"] as const;

function fileUrl(folder: "crests" | "marks", base: string): string | undefined {
  for (const ext of EXTENSIONS) {
    const url = URLS[`./${folder}/${base}.${ext}`];
    if (url) return url;
  }
  return undefined;
}

const warned = new Set<string>();

/** Say once per build that a club has no crest yet. In GitHub Actions the
 *  message becomes a warning on the run's summary page. Never fails the build. */
function warnMissing(slug: string, name: string): void {
  if (warned.has(slug)) return;
  warned.add(slug);
  const text = `no crest for "${name}" (${slug}): using the fallback crest. Add the club to src/identity/clubs/ and run node scripts/make-crests.mjs.`;
  console.warn(process.env["GITHUB_ACTIONS"] ? `::warning::${text}` : `[tabletalk] ${text}`);
}

/** The crest to show for a club. A club with no file gets the fallback crest
 *  (grey shield, its initials) and a build warning; the build carries on. */
export function crestSource(slug: string, name: string, variant: CrestVariant): CrestSource {
  const base = variant === "small" ? `${slug}-small` : slug;
  // A club with only a full crest (an official file, say) uses it at every size.
  const src = fileUrl("crests", base) ?? fileUrl("crests", slug);
  if (src) return { kind: "file", src };
  warnMissing(slug, name);
  return { kind: "fallback", svg: renderCrest(fallbackDesign(name, variant), `c-fallback-${slug}`) };
}

/** The crest's SVG markup, for writing straight into a page (the team-page
 *  hero: no extra request before it paints). Undefined if the club's crest
 *  isn't an SVG of ours (a raster official file): use crestSource instead. */
export function crestInline(slug: string, name: string): string | undefined {
  const raw = RAW[`./crests/${slug}.svg`];
  if (raw) return raw.trim();
  const source = crestSource(slug, name, "full");
  return source.kind === "fallback" ? source.svg : undefined;
}

/**
 * An SVG document as an element for the page: drawn at `size` px, and either
 * hidden from screen readers (decorative, the usual case: the club's name is
 * written next to it) or announced as one image with `label`.
 */
export function svgElement(svg: string, size: number, cls: string, label?: string): string {
  const a11y = label
    ? `role="img" aria-label="${label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`
    : `aria-hidden="true"`;
  return svg
    .replace(/ width="\d+" height="\d+"/, ` width="${size}" height="${size}"`)
    .replace("<svg ", `<svg class="${cls}" ${a11y} focusable="false" `);
}

/** A league's mark file, or undefined for a league with no mark. */
export function leagueMarkUrl(leagueSlug: string): string | undefined {
  return fileUrl("marks", leagueSlug);
}
