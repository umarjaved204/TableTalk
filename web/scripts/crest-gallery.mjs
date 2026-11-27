// The crest review gallery: one standalone HTML page with every crest in the
// registry, for review before any page uses them (Phase 4 approval).
//
//   node scripts/crest-gallery.mjs [--out crest-gallery/index.html] [--status status.html]
//
// Written to crest-gallery/ (gitignored): it is a review tool, not part of
// the site. Every picture is described in words too, so the page can be
// read as text. It shows:
//   - the league marks;
//   - the crests in a real standings table and real fixture cards (from the
//     local copy of the data in .data/, if there is one), on a light and a
//     dark theme;
//   - clubs whose colours could be confused, side by side at every size;
//   - each club: its full and small crest on light and dark, the colours,
//     the heritage behind the design, how close it may look to the official
//     badge, and the alternatives for any design that may look too close;
//   - the fallback crest that a club with no entry gets.
// --status inserts an HTML fragment (a review status block) after the title.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { LEAGUES } from "../src/data/leagues.ts";
import { teamSlug } from "../src/data/teams.ts";
import { CLUBS } from "../src/identity/clubs/index.ts";
import { fallbackDesign, renderCrest } from "../src/identity/crest.ts";
import { LEAGUE_IDENTITIES, leagueMarkDesign } from "../src/identity/leagues.ts";

const { values: args } = parseArgs({
  options: { out: { type: "string", default: "crest-gallery/index.html" }, status: { type: "string" } },
});

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Every picture is defined once as a <symbol> and drawn with <use>, so the
// page stays small however often a crest appears.
const symbols = new Map();
function define(key, svgDocument) {
  if (!symbols.has(key)) {
    const inner = svgDocument.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    symbols.set(key, `<symbol id="s-${key}" viewBox="0 0 120 120">${inner}</symbol>`);
  }
  return key;
}
const use = (key, size, label) =>
  `<svg class="cr" width="${size}" height="${size}" ${label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`}><use href="#s-${key}"/></svg>`;

const crestKey = (club, variant) =>
  define(
    `${club.slug}-${variant}`,
    renderCrest(
      variant === "small" ? club.small : club.full,
      `c-${club.slug}${variant === "small" ? "-s" : ""}`,
    ),
  );
const altKey = (club, n, variant) =>
  define(
    `${club.slug}-alt${n}-${variant}`,
    renderCrest(club.alternatives[n][variant], `c-${club.slug}-a${n}${variant === "small" ? "-s" : ""}`),
  );
const markKey = (league) =>
  define(`mark-${league.slug}`, renderCrest(leagueMarkDesign(league), `m-${league.slug}`));

const bySlug = new Map(CLUBS.map((c) => [c.slug, c]));
/** A club's crest at a size, or the fallback crest for a club with no entry. */
function crestFor(name, size) {
  const club = bySlug.get(teamSlug(name));
  const variant = size <= 24 ? "small" : "full";
  if (club) return use(crestKey(club, variant), size);
  const slug = teamSlug(name);
  return use(
    define(
      `fallback-${slug}-${variant}`,
      renderCrest(fallbackDesign(name, variant), `c-fallback-${slug}${variant === "small" ? "-s" : ""}`),
    ),
    size,
  );
}

// Real data, if the local copy is there.
function readLeague(id) {
  const path = `.data/latest/${id}.json`;
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}
const source = existsSync(".data/SOURCE.json") ? JSON.parse(readFileSync(".data/SOURCE.json", "utf8")) : null;

const THEMES = [
  { name: "Matchday (light)", cls: "t-light" },
  { name: "Floodlights (dark)", cls: "t-dark" },
];

const pct = (p) => (p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);

function standings(id) {
  const data = readLeague(id);
  if (!data) return `<p>No local data (run <code>npm run data</code>): standings preview skipped.</p>`;
  const rows = data.table
    .map(
      (r) =>
        `<tr><td class="num">${r.position}</td><td class="team">${crestFor(r.team, 20)}<span>${esc(r.team)}</span></td><td class="num">${r.played}</td><td class="num">${r.goal_difference > 0 ? "+" : ""}${r.goal_difference}</td><td class="num"><b>${r.points}</b></td></tr>`,
    )
    .join("");
  const table = `<table class="standings"><thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
  return `<div class="pair">${THEMES.map((t) => `<div class="theme ${t.cls}"><p class="tname">${t.name}</p>${table}</div>`).join("")}</div>`;
}

function fixtures(id, count = 6) {
  const data = readLeague(id);
  if (!data) return "";
  const cards = data.upcoming_matches
    .slice(0, count)
    .map((m) => {
      const p = m.probabilities;
      return `<article class="match"><p class="when">${esc(m.matchday)} · ${esc(m.date)}</p><div class="side">${crestFor(m.home_team, 24)}<span>${esc(m.home_team)}</span><b>${pct(p.home)}</b></div><div class="side">${crestFor(m.away_team, 24)}<span>${esc(m.away_team)}</span><b>${pct(p.away)}</b></div><p class="when">Draw ${pct(p.draw)}</p></article>`;
    })
    .join("");
  return `<div class="pair">${THEMES.map((t) => `<div class="theme ${t.cls}"><p class="tname">${t.name}</p><div class="matches">${cards}</div></div>`).join("")}</div>`;
}

/** Groups of clubs whose colours could be confused, and what tells them apart. */
const CLASHES = [
  {
    title: "Manchester",
    slugs: ["manchester-city", "manchester-united"],
    note: "Same city, both often abbreviated MAN. City: sky-blue French shield with a navy bee. United: red heater shield with a gold trident. Different colour, outline and symbol at every size.",
  },
  {
    title: "Sky blue",
    slugs: ["manchester-city", "coventry-city"],
    note: "Both sky blue. City is a French shield with a navy bee; Coventry a roundel with a white phoenix and orange flames.",
  },
  {
    title: "Red, white and gold",
    slugs: ["arsenal", "liverpool", "nottingham-forest", "manchester-united"],
    note: "Four red crests. Arsenal is the only roundel (white disc, red gun); Liverpool a round-bottomed shield (white bird); Forest a French shield (white bow); United a pointed heater (gold trident). At 16 px the outline does most of the work: circle, round bottom, ogee point, sharp point.",
  },
  {
    title: "Red stripes",
    slugs: ["brentford", "sunderland", "bournemouth"],
    note: "All striped. Brentford: red and white on a heater with a bee. Sunderland: red and white on an angular shield with a black cat. Bournemouth: red and black on a round-bottomed shield with cherries.",
  },
  {
    title: "Royal blue",
    slugs: ["chelsea", "everton", "ipswich-town", "brighton-and-hove-albion"],
    note: "Chelsea a roundel (lion's head), Everton a heater (tower), Ipswich an oval (ship), Brighton a heater with blue-and-white stripes (gull). Everton and Brighton share an outline: Everton's small crest is solid blue with a white tower, Brighton's has stripes at the point and a gull.",
  },
  {
    title: "Black and white",
    slugs: ["newcastle-united", "fulham"],
    note: "Newcastle: striped heater with a castle in a black disc. Fulham: white roundel with a black cottage.",
  },
  {
    title: "Claret, red and blue",
    slugs: ["aston-villa", "crystal-palace"],
    note: "Villa: claret heater with a sky-blue lion. Palace: French shield halved red and blue with a white glass palace.",
  },
  {
    title: "Navy, white and yellow",
    slugs: ["tottenham-hotspur", "leeds-united"],
    note: "Spurs: navy French shield with a white spur (a star-shaped rowel when small). Leeds: angular shield with a white rose and a yellow chevron.",
  },
];

function clashSection() {
  return CLASHES.filter((g) => g.slugs.every((s) => bySlug.has(s)))
    .map((g) => {
      const clubs = g.slugs.map((s) => bySlug.get(s));
      const strip = (cls) =>
        `<div class="theme ${cls} strip">${clubs
          .map(
            (c) =>
              `<figure>${use(crestKey(c, "full"), 64)}${use(crestKey(c, "small"), 24)}${use(crestKey(c, "small"), 16)}<figcaption>${esc(c.short)}</figcaption></figure>`,
          )
          .join("")}</div>`;
      return `<div class="clash"><h3>${esc(g.title)}</h3><p>${esc(g.note)}</p><div class="pair">${strip("t-light")}${strip("t-dark")}</div></div>`;
    })
    .join("");
}

const LEVEL_TEXT = {
  low: "Low: a different symbol and composition from the official badge.",
  medium: "Medium: the same heritage symbol, in a clearly different composition.",
  high: "High: a supporter may connect this with the official badge. Alternatives below.",
};

function variantsBlock(fullKey, smallKey, name) {
  const onTheme = (cls) =>
    `<div class="theme ${cls} sizes">${use(fullKey, 120, `${name} crest`)}${use(fullKey, 40)}${use(smallKey, 24)}${use(smallKey, 16)}</div>`;
  return `<div class="pair">${onTheme("t-light")}${onTheme("t-dark")}</div>`;
}

function clubCard(club) {
  const swatches = club.colours
    .map(
      (c) =>
        `<li><span class="sw" style="background:${c.hex}"></span>${esc(c.name)} <code>${c.hex}</code></li>`,
    )
    .join("");
  const b = club.band;
  const band = `<div class="band" style="background:${b.bg};color:${b.ink};border-color:${b.accent}">${use(crestKey(club, "full"), 48)}<div><p class="bname">${esc(club.name)}</p><p style="color:${b.muted}">Hero band: ${esc(club.nickname)}, founded ${club.founded}</p></div></div>`;
  const alts = (club.alternatives ?? [])
    .map(
      (alt, n) =>
        `<div class="alt"><h4>Alternative: ${esc(alt.title)}</h4><p>${esc(alt.note)}</p>${variantsBlock(altKey(club, n, "full"), altKey(club, n, "small"), `${club.name} alternative ${alt.title}`)}<p class="looks"><b>Full:</b> ${esc(alt.looks.full)}<br><b>Small:</b> ${esc(alt.looks.small)}</p></div>`,
    )
    .join("");
  return `<article class="club" id="club-${club.slug}">
<header><h3>${esc(club.name)}</h3><p class="meta">${esc(club.nickname)} · founded ${club.founded} · <code>${club.short}</code> · <code>${club.slug}</code></p></header>
${variantsBlock(crestKey(club, "full"), crestKey(club, "small"), club.name)}
<p class="looks"><b>Full crest:</b> ${esc(club.looks.full)}<br><b>Small crest:</b> ${esc(club.looks.small)}</p>
<p><b>Inspiration:</b> ${esc(club.inspiration)}</p>
<p class="res res-${club.resemblance.level}"><b>Resemblance to the official badge: ${LEVEL_TEXT[club.resemblance.level]}</b><br>${esc(club.resemblance.note)}</p>
<ul class="colours">${swatches}</ul>
${band}
${alts}
</article>`;
}

function leagueSection() {
  const strip = (cls) =>
    `<div class="theme ${cls} strip">${LEAGUE_IDENTITIES.map((l) => {
      const k = markKey(l);
      return `<figure>${use(k, 64, `${l.code} mark`)}${use(k, 24)}${use(k, 16)}<figcaption>${l.code}</figcaption></figure>`;
    }).join("")}</div>`;
  const notes = LEAGUE_IDENTITIES.map(
    (l) =>
      `<li><b>${esc(LEAGUES.find((x) => x.id === l.leagueId).name)} (${l.code}):</b> ${esc(l.inspiration)}</li>`,
  ).join("");
  return `<div class="pair">${strip("t-light")}${strip("t-dark")}</div><ul>${notes}</ul>`;
}

function fallbackSection() {
  const examples = Object.entries({
    bundesliga: "Hamburger SV",
    ligue_1: "Paris FC",
    la_liga: "Deportivo La Coruña",
  });
  return `<div class="pair">${THEMES.map(
    (t) =>
      `<div class="theme ${t.cls} strip">${examples
        .map(
          ([, name]) =>
            `<figure>${crestFor(name, 64)}${crestFor(name, 24)}${crestFor(name, 16)}<figcaption>${esc(name)}</figcaption></figure>`,
        )
        .join("")}</div>`,
  ).join("")}</div>`;
}

const covered = [...new Set(CLUBS.map((c) => c.leagueId))];
const leagueClubs = covered.map((id) => {
  const league = LEAGUES.find((l) => l.id === id);
  return `<section><h2>${esc(league.name)}: every club</h2><p>In alphabetical order.</p>${CLUBS.filter(
    (c) => c.leagueId === id,
  )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(clubCard)
    .join("")}</section>`;
});

const status = args.status ? readFileSync(args.status, "utf8") : "";
const dataLine = source
  ? `Standings and fixtures from the local copy of the published data (data branch commit <code>${source.commit.slice(0, 7)}</code>, copied ${source.copied_at.slice(0, 10)}).`
  : "No local data: standings and fixtures are skipped.";

const body = `
<header class="top"><h1>TableTalk crest gallery</h1>
<p>Every crest in the registry, for review before any page uses them. ${CLUBS.length} clubs drawn so far, ${CLUBS.reduce((n, c) => n + (c.alternatives?.length ?? 0), 0)} alternative designs. Each picture is also described in words.</p>
<ul class="chips"><li>Original drawings, no official artwork</li><li>Full crest from 28 px, small crest up to 24 px</li><li>Light: Matchday · Dark: Floodlights</li></ul></header>
${status}
<section><h2>How to read this page</h2>
<ul>
<li><b>Sizes.</b> Each crest is shown at 120 px and 40 px (full crest) and at 24 px and 16 px (small crest), first on the light theme, then on the dark theme. 24 px is a fixture card; 20 px a standings row; 16 px the smallest planned use.</li>
<li><b>White keyline.</b> Every crest has a thin white outline, so dark crests (Newcastle, Fulham, Spurs) stay visible on the dark themes.</li>
<li><b>Resemblance.</b> Every design is an original drawing. "Low", "medium" or "high" says how likely a supporter is to connect it with the official badge; every "high" design has at least one alternative to choose instead.</li>
<li><b>${dataLine}</b></li>
</ul></section>
<section><h2>League marks</h2><p>TableTalk's own marks, not the competitions' logos: two slanted stripes in the country's flag colours and the league's initials, on a tile.</p>${leagueSection()}</section>
${covered
  .map((id) => {
    const league = LEAGUES.find((l) => l.id === id);
    return `<section><h2>${esc(league.name)}: standings preview</h2><p>The real table with the 20 px small crest in each row, as a league page would show it.</p>${standings(id)}</section>
<section><h2>${esc(league.name)}: fixture cards</h2><p>The next six matches with the 24 px small crest beside each team, and the model's chances.</p>${fixtures(id)}</section>`;
  })
  .join("")}
<section><h2>Clubs that could be confused</h2><p>Groups with similar colours or names, side by side: full crest at 64 px, small crest at 24 px and 16 px.</p>${clashSection()}</section>
${leagueClubs.join("")}
<section><h2>The fallback crest</h2><p>A club with no entry in the registry yet (a newly promoted club, or a club renamed in the data) gets this instead of a broken image: a plain grey shield with a dashed inner line and up to three initials, clearly a placeholder and never a guess at its colours. The build prints a warning naming the club and carries on, so the nightly data publish is never blocked. The examples are clubs from leagues whose crests are not drawn yet.</p>${fallbackSection()}</section>
`;

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TableTalk Crest Gallery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>
:root { --bg:#f5f4ee; --surface:#fff; --border:#dfddd3; --text:#0e1a13; --muted:#4a5a50; --accent:#0a6b3b; --warn-bg:#fdf0d5; --warn:#5c3d00;
  --display:"Barlow Condensed","Arial Narrow",sans-serif; --body:"Source Sans 3","Segoe UI",system-ui,sans-serif; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0a1210; --surface:#111b17; --border:#26352e; --text:#edf3ef; --muted:#a0b0a6; --accent:#3fd98a; --warn-bg:#3a2c0c; --warn:#ffe2a3; color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#0a1210; --surface:#111b17; --border:#26352e; --text:#edf3ef; --muted:#a0b0a6; --accent:#3fd98a; --warn-bg:#3a2c0c; --warn:#ffe2a3; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.5 var(--body); padding-block:0; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }
main { max-width:1100px; margin:0 auto; padding:32px 0 80px; display:grid; gap:36px; }
h1,h2,h3,h4 { font-family:var(--display); line-height:1.05; margin:0 0 8px; text-wrap:balance; }
h1 { font-size:2.8rem; text-transform:uppercase; }
h2 { font-size:1.9rem; text-transform:uppercase; border-bottom:3px solid var(--accent); padding-bottom:6px; margin-bottom:14px; }
h3 { font-size:1.5rem; } h4 { font-size:1.2rem; }
p { margin:0 0 10px; max-width:75ch; }
code { font-family:ui-monospace,Consolas,monospace; font-size:.85em; }
.chips { display:flex; flex-wrap:wrap; gap:8px; list-style:none; padding:0; margin:10px 0 0; }
.chips li { border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:2px 10px; font-weight:600; font-size:.85rem; }
.cr { display:inline-block; vertical-align:middle; flex:none; }
.pair { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap:10px; margin:8px 0 12px; }
.theme { border-radius:10px; padding:12px; border:1px solid var(--border); min-width:0; }
.t-light { background:#f5f4ee; color:#0e1a13; } .t-light .match, .t-light .standings { background:#fff; }
.t-dark { background:#0a1210; color:#edf3ef; border-color:#26352e; } .t-dark .match, .t-dark .standings { background:#111b17; }
.tname { font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin:0 0 6px; opacity:.8; }
.sizes { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.strip { display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end; }
figure { margin:0; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
figcaption { font-size:.85rem; font-weight:600; width:100%; }
.standings { border-collapse:collapse; width:100%; font-size:.9rem; border-radius:8px; overflow:hidden; }
.standings th, .standings td { padding:4px 8px; text-align:left; border-bottom:1px solid #8883; }
.standings .num { text-align:right; font-variant-numeric:tabular-nums; width:3em; }
.standings .team { display:flex; align-items:center; gap:8px; }
.matches { display:grid; gap:8px; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
.match { border-radius:8px; padding:8px 10px; display:grid; gap:4px; font-size:.9rem; }
.match .side { display:grid; grid-template-columns:24px 1fr auto; align-items:center; gap:8px; }
.when { font-size:.8rem; opacity:.75; margin:0; }
.clash { margin-bottom:16px; }
.club { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px; }
.club header h3 { font-size:1.8rem; text-transform:uppercase; margin:0; }
.meta { color:var(--muted); font-size:.9rem; }
.looks { font-size:.95rem; }
.res { border-left:5px solid; padding:8px 12px; border-radius:6px; }
.res-low { border-color:#2f8a55; background:color-mix(in srgb, #2f8a55 10%, transparent); }
.res-medium { border-color:#c98a00; background:color-mix(in srgb, #c98a00 12%, transparent); }
.res-high { border-color:#c0392b; background:color-mix(in srgb, #c0392b 12%, transparent); }
.colours { display:flex; flex-wrap:wrap; gap:6px 16px; list-style:none; padding:0; margin:0 0 10px; font-size:.9rem; }
.sw { display:inline-block; width:14px; height:14px; border-radius:3px; border:1px solid #8888; vertical-align:-2px; margin-right:6px; }
.band { display:flex; align-items:center; gap:14px; border-radius:12px; padding:12px 16px; border:1px solid; margin-bottom:8px; }
.band p { margin:0; } .bname { font-family:var(--display); font-weight:700; font-size:1.5rem; text-transform:uppercase; line-height:1; }
.alt { border-top:1px dashed var(--border); margin-top:12px; padding-top:12px; }
.status { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:18px 20px; }
.stop { background:var(--warn-bg); color:var(--warn); border-radius:8px; padding:18px 20px; }
.scroll { overflow-x:auto; border:1px solid var(--border); border-radius:8px; background:var(--surface); margin-bottom:14px; }
.scroll table { border-collapse:collapse; width:100%; font-size:.9rem; }
.scroll th, .scroll td { text-align:left; vertical-align:top; padding:6px 10px; border-bottom:1px solid var(--border); }
pre { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px; overflow-x:auto; font-size:.8rem; }
</style></head>
<body><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...symbols.values()].join("")}</defs></svg>
<main>${body}</main></body></html>
`;

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, html, "utf8");
console.log(`wrote ${args.out}: ${symbols.size} pictures, ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
