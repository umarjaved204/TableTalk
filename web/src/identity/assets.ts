// Where a club's crest comes from, at build time. The one place that knows
// about files: ClubCrest and LeagueMark only ask for "the crest of this club
// at this size" and get back an image address, or SVG to write into the page.
//
// Asset-agnostic on purpose. The crests are TableTalk's own drawings today.
// If official crests are licensed later, put each one in src/identity/crests/
// under the same name (<slug>.svg, or .png/.webp at 240 x 240 or larger) and
// nothing else changes: components, pages and layouts stay as they are.
//
// Supplied crests: artwork the site's owner chose as a club's full crest
// (src/identity/supplied/crests/<slug>, described in supplied.ts) takes the
// place of TableTalk's full crest. At 24 px and below the club's own small
// SVG crest is still used, unless a supplied <slug>-small file exists.
//
// League marks come from one of three places, first match wins:
//   1. src/identity/licensed/marks/  genuinely official or licensed files
//                                    (none today; see the README there)
//   2. src/identity/supplied/marks/  artwork supplied by the site's owner
//                                    (supplied.ts: what it is, resemblance)
//   3. src/identity/marks/           TableTalk's own marks (make-crests.mjs,
//                                    which clears that folder of anything it
//                                    doesn't make, hence the separate folders)
// Each is <league-slug>.svg/.png/.webp, with an optional <league-slug>-dark
// file shown on dark themes instead (identity.css switches them).
//
// Files are imported through Vite, so they are copied to /_astro/ with a
// content hash in the name and cached for a year (public/_headers). Vite
// would normally write small files into the page as data: addresses instead;
// astro.config.mjs turns that off for this folder so every crest is fetched
// once and then comes from the cache on every page.
import { fallbackDesign, renderCrest } from "./crest.ts";
import type { CrestVariant } from "./sizes.ts";

const URLS = import.meta.glob<string>(
  "./{crests,marks,licensed/marks,supplied/marks,supplied/crests}/*.{svg,png,webp}",
  {
    query: "?url",
    import: "default",
    eager: true,
  },
);
const RAW = import.meta.glob<string>("./crests/*.svg", { query: "?raw", import: "default", eager: true });

export { SMALL_MAX, variantFor, type CrestVariant } from "./sizes.ts";

export type CrestSource =
  /** A file: shown with <img src>. */
  | { kind: "file"; src: string }
  /** No file: the fallback crest, written into the page. */
  | { kind: "fallback"; svg: string };

const EXTENSIONS = ["svg", "png", "webp"] as const;

type Folder = "crests" | "marks" | "licensed/marks" | "supplied/marks" | "supplied/crests";

function fileUrl(folder: Folder, base: string): string | undefined {
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
  // Supplied artwork first, then TableTalk's own file for this size; a club
  // with only a full crest (an official file, say) uses it at every size.
  const src =
    fileUrl("supplied/crests", base) ??
    fileUrl("crests", base) ??
    fileUrl("supplied/crests", slug) ??
    fileUrl("crests", slug);
  if (src) return { kind: "file", src };
  warnMissing(slug, name);
  return { kind: "fallback", svg: renderCrest(fallbackDesign(name, variant), `c-fallback-${slug}`) };
}

/** The crest's SVG markup, for writing straight into a page (the team-page
 *  hero: no extra request before it paints). Undefined if the club's crest
 *  isn't an SVG of ours (a supplied or official image file): use crestSource instead. */
export function crestInline(slug: string, name: string): string | undefined {
  // A supplied full crest is an image file: never write TableTalk's SVG instead.
  if (fileUrl("supplied/crests", slug)) return undefined;
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

/** Where a league mark's file came from. */
export type MarkSource = "licensed" | "supplied" | "generated";

export interface LeagueMarkFile {
  source: MarkSource;
  /** The file for light themes (and every theme, without `darkSrc`). */
  src: string;
  /** The file for dark themes, where the artwork has one. */
  darkSrc?: string;
}

const MARK_FOLDERS: readonly [MarkSource, Folder][] = [
  ["licensed", "licensed/marks"],
  ["supplied", "supplied/marks"],
  ["generated", "marks"],
];

/** A league's mark: a licensed file, else supplied artwork, else TableTalk's
 *  own mark; undefined for a league with none. */
export function leagueMark(leagueSlug: string): LeagueMarkFile | undefined {
  for (const [source, folder] of MARK_FOLDERS) {
    const src = fileUrl(folder, leagueSlug);
    if (!src) continue;
    const darkSrc = fileUrl(folder, `${leagueSlug}-dark`);
    return darkSrc ? { source, src, darkSrc } : { source, src };
  }
  return undefined;
}

/** The address of a league's mark for light themes (see leagueMark). */
export function leagueMarkUrl(leagueSlug: string): string | undefined {
  return leagueMark(leagueSlug)?.src;
}
