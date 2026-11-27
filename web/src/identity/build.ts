// Everything the identity system writes to disk, as text, in one place:
//   src/identity/crests/<slug>.svg         full crest (above 24 px)
//   src/identity/crests/<slug>-small.svg   small crest (24 px and below)
//   src/identity/marks/<league slug>.svg   league mark
//   src/styles/identity.css                club and league colours for bands
//
// scripts/make-crests.mjs writes these files; tests/unit/identity.test.ts
// checks the committed files are exactly what this module makes, so a design
// change can't ship without its files, or the files drift from the designs.
import { renderCrest } from "./crest.ts";
import { CLUBS } from "./clubs/index.ts";
import { LEAGUE_IDENTITIES, leagueMarkDesign } from "./leagues.ts";

/** Path (relative to web/) -> file contents. */
export function identityFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const club of CLUBS) {
    // Clip ids carry the slug, so two crests written into one page never clash.
    files.set(`src/identity/crests/${club.slug}.svg`, renderCrest(club.full, `c-${club.slug}`) + "\n");
    files.set(
      `src/identity/crests/${club.slug}-small.svg`,
      renderCrest(club.small, `c-${club.slug}-s`) + "\n",
    );
  }
  for (const league of LEAGUE_IDENTITIES) {
    files.set(
      `src/identity/marks/${league.slug}.svg`,
      renderCrest(leagueMarkDesign(league), `m-${league.slug}`) + "\n",
    );
  }
  files.set("src/styles/identity.css", identityCss());
  return files;
}

/** "#ffcc00" -> "#fc0": the stylesheet's colours in their shortest form (Stylelint's rule). */
function hex(colour: string): string {
  const m = /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/i.exec(colour);
  return m ? `#${m[1]}${m[2]}${m[3]}`.toLowerCase() : colour.toLowerCase();
}

/** The share of the accent colour used for a band's edge line. */
const EDGE_SHARE = "45%";

/**
 * Club and league colours as custom properties. A team page's hero sets
 * data-club="<slug>" and a league header data-league="<slug>"; .band in
 * blocks.css paints itself from --club-*. With no attribute, or a club with
 * no entry yet, the theme's own band colours apply (tokens/base.css).
 *
 * High Contrast keeps its own black-and-white band for every club: club
 * colours would undo the reason for choosing it.
 */
export function identityCss(): string {
  const rule = (selector: string, b: { bg: string; ink: string; muted: string; accent: string }) =>
    `${selector} {\n` +
    `  --club-1: ${hex(b.bg)};\n` +
    `  --club-2: ${hex(b.accent)};\n` +
    `  --club-ink: ${hex(b.ink)};\n` +
    `  --club-muted: ${hex(b.muted)};\n` +
    `  --band-edge: color-mix(in srgb, ${hex(b.accent)} ${EDGE_SHARE}, transparent);\n` +
    `}\n`;
  return [
    "/* Club and league band colours. Written by scripts/make-crests.mjs from\n" +
      "   src/identity/ (clubs/*.ts and leagues.ts): edit those, then run the\n" +
      "   script. Never edited by hand; tests/unit/identity.test.ts checks it. */\n",
    ...CLUBS.map((club) => rule(`[data-club="${club.slug}"]`, club.band)),
    ...LEAGUE_IDENTITIES.map((league) => rule(`[data-league="${league.slug}"]`, league.band)),
    `[data-theme="contrast"] :is([data-club], [data-league]) {\n` +
      `  --club-1: var(--band-bg);\n` +
      `  --club-2: var(--band-accent);\n` +
      `  --club-ink: var(--band-ink);\n` +
      `  --club-muted: var(--band-muted);\n` +
      `  --band-edge: var(--border);\n` +
      `}\n`,
  ].join("\n");
}
