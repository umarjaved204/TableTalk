// The crest review gallery: one standalone HTML page with every crest in the
// registry, for review before any page uses them (Phase 4 approval).
//
//   node scripts/crest-gallery.mjs [--out crest-gallery/index.html]
//                                  [--previous snapshot.json] [--status status.html]
//   node scripts/crest-gallery.mjs --snapshot snapshot.json
//
// Written to crest-gallery/ (gitignored): a review tool, not part of the
// site. Self-contained: the site's own fonts are embedded and nothing is
// loaded from anywhere else. Every picture is also described in words, so
// the page can be read as text. It shows:
//   - with --previous, the designs as they were when the snapshot was taken
//     next to the current ones, for every crest and mark that changed;
//   - the league marks;
//   - the crests in a real standings table and real fixture cards (from the
//     local copy of the data in .data/, if there is one), on a light and a
//     dark theme;
//   - clubs whose crests could be confused, side by side at every size;
//   - each club: its full and small crest on light and dark, the colours,
//     the heritage behind the design, how close it may look to the official
//     badge, and the alternatives;
//   - the resemblance ratings and the file sizes, in tables;
//   - the fallback crest that a club with no entry gets.
// --league <id> (premier_league, la_liga, ...) limits the clubs shown to one
// league, for a league's own review; the league marks are always shown.
// --clubs slug,slug limits it to named clubs (a targeted revision's review).
// --snapshot writes the current designs to a file (to compare against after
// the next round of changes) and stops. --status inserts an HTML fragment
// (a review status block) after the title.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { LEAGUES } from "../src/data/leagues.ts";
import { teamSlug } from "../src/data/teams.ts";
import { identityFiles } from "../src/identity/build.ts";
import { CLUBS } from "../src/identity/clubs/index.ts";
import { SUPPLIED_LABEL } from "../src/identity/supplied.ts";
import { fallbackDesign, renderCrest } from "../src/identity/crest.ts";
import { LEAGUE_IDENTITIES, leagueMarkDesign } from "../src/identity/leagues.ts";
import { SMALL_MAX, variantFor } from "../src/identity/sizes.ts";

const { values: args } = parseArgs({
  options: {
    out: { type: "string", default: "crest-gallery/index.html" },
    status: { type: "string" },
    previous: { type: "string" },
    snapshot: { type: "string" },
    league: { type: "string" },
    clubs: { type: "string" },
  },
});

// Snapshot: the current designs as SVG, by club and league.
if (args.snapshot) {
  const snap = { taken: new Date().toISOString(), clubs: {}, marks: {} };
  for (const c of CLUBS)
    snap.clubs[c.slug] = {
      full: renderCrest(c.full, `p-${c.slug}`),
      small: renderCrest(c.small, `p-${c.slug}-s`),
      resemblance: c.resemblance.level,
    };
  for (const l of LEAGUE_IDENTITIES) snap.marks[l.slug] = renderCrest(leagueMarkDesign(l), `pm-${l.slug}`);
  writeFileSync(args.snapshot, JSON.stringify(snap), "utf8");
  console.log(`wrote ${args.snapshot}: ${CLUBS.length} clubs, ${LEAGUE_IDENTITIES.length} marks`);
  process.exit(0);
}

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// The site's own fonts, embedded so the page loads nothing from elsewhere.
const require = createRequire(import.meta.url);
const font = (file) => readFileSync(require.resolve(file)).toString("base64");
const FONTS = `
@font-face { font-family:"Barlow Condensed"; font-weight:600; src:url(data:font/woff2;base64,${font("@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2")}) format("woff2"); }
@font-face { font-family:"Barlow Condensed"; font-weight:700; src:url(data:font/woff2;base64,${font("@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2")}) format("woff2"); }
@font-face { font-family:"Source Sans 3"; font-weight:200 900; src:url(data:font/woff2;base64,${font("@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2")}) format("woff2"); }`;

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
/** The clubs this gallery shows: all, or one league's with --league. */
const onlyClubs = args.clubs ? new Set(args.clubs.split(",")) : null;
const SHOWN = CLUBS.filter(
  (c) => (!args.league || c.leagueId === args.league) && (!onlyClubs || onlyClubs.has(c.slug)),
);
if (SHOWN.length === 0) throw new Error("no clubs match --league/--clubs");
const shownSlugs = new Set(SHOWN.map((c) => c.slug));
/** A club's crest at a size, or the fallback crest for a club with no entry. */
function crestFor(name, size) {
  const club = bySlug.get(teamSlug(name));
  const variant = variantFor(size);
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

/** Groups of clubs whose crests could be confused, and what tells them apart. */
const CLASHES = [
  {
    title: "Three diamonds",
    slugs: ["werder-bremen", "hamburger-sv", "borussia-monchengladbach"],
    note: "All three clubs have worn a diamond for generations, so all three keep it. Werder: square-on green diamond with rounded corners and a white W. HSV: a blue square block holding a white-edged diamond split into black and white triangles, no letter. Gladbach: tall narrow rhombus, black edge, a green band and a black B.",
  },
  {
    title: "Red roundels",
    slugs: ["bayern-munich", "mainz-05", "union-berlin"],
    note: "Bayern: a red ring of lettering round blue and white lozenges. Mainz: solid red with a large white 05. Union is no longer a roundel: a slanted red plate with yellow UNION, 1.FC above and the bear in a small disc.",
  },
  {
    title: "Blue and white",
    slugs: ["schalke-04", "paderborn-07", "tsg-hoffenheim"],
    note: "Schalke: a solid royal blue roundel with white S04. Paderborn: a roundel white above and blue below, a black bar between, SC and 07. Hoffenheim: not a roundel but a peaked blue shield crossed by a white band.",
  },
  {
    title: "Black, white and a ring",
    slugs: ["eintracht-frankfurt", "sv-elversberg", "bayer-leverkusen", "sc-freiburg"],
    note: "Frankfurt: a red eagle on a white roundel with a red edge. Elversberg: black SVE on white inside a black ring with a gold edge. Leverkusen: two red heraldic lions and yellow banners round a small 04 medallion, with no enclosing roundel. Freiburg: an upright oval divided black and white, with a raptor's head and SCF.",
  },
  {
    title: "Red and white shields",
    slugs: ["1-fc-koln", "vfb-stuttgart", "fc-augsburg", "rb-leipzig"],
    note: "Köln: a red goat standing on a red-ringed roundel with a small cathedral inside. Stuttgart: a heater with slanted red VfB on white over gold and three black heraldic antlers. Augsburg: round-bottomed, red and white halves, a green pine cone. Leipzig: a white round-bottomed shield with a navy edge, a red lion over navy RBL and a red base.",
  },
  {
    title: "Red and white stripes",
    slugs: ["atletico-madrid", "athletic-bilbao"],
    note: "The two rojiblanco clubs (Atlético was founded by Basque students as a branch of Athletic). Atlético: a pointed heater with a navy upper half and the seven stars of the Great Bear. Athletic: a round-bottomed shield with a white upper half and a red heraldic lion walking.",
  },
  {
    title: "Blue and garnet",
    slugs: ["barcelona", "levante"],
    note: "Both blue and red-purple. Barcelona: a Catalan shield with raised shoulders, the senyera across the top, a cross medallion and FCB over blue and garnet stripes. Levante: a pointed heater halved blue and claret under a white chief, with a white frog.",
  },
  {
    title: "Blue and white",
    slugs: ["real-sociedad", "deportivo-la-coruna", "espanyol", "alaves", "malaga", "getafe"],
    note: "Six blue-and-white clubs, kept apart by outline and symbol: Real Sociedad a crowned roundel with a ball and a pennant; Deportivo a heater with the tower on a white pale; Espanyol an oval with the parakeet; Alavés an angular shield with a large A; Málaga a round-bottomed shield with the anchovy disc; Getafe a French shield with the biplane on a white sash.",
  },
  {
    title: "Green and white",
    slugs: ["real-betis", "racing-santander", "elche"],
    note: "Betis: a crowned inverted triangle with green and white stripes and BETIS. Racing: a green roundel with the stela and a lettered ring. Elche: a white arch with a green band and a palm.",
  },
  {
    title: "White with a dark symbol",
    slugs: ["real-madrid", "valencia", "sevilla", "rayo-vallecano"],
    note: "Real Madrid: a crowned white roundel with an interlaced navy RM. Valencia: a round-bottomed shield with the black bat across its top over gold and red stripes. Sevilla: a lobed shield, red above with NO8DO, white below with SFC. Rayo: a white angular shield with a red sash and a black bolt.",
  },
  {
    title: "Two crowned roundels",
    slugs: ["real-madrid", "real-sociedad"],
    note: "Both clubs' traditional badges are crowned circles, so both crests keep that form. Real Madrid: white with a gold rim and an interlaced navy RM. Real Sociedad: blue ring with its name, blue and white stripes, a football and a pennant.",
  },
  {
    title: "Madrid",
    slugs: ["real-madrid", "atletico-madrid", "getafe", "rayo-vallecano"],
    note: "The four clubs of the Madrid area: crowned white roundel with RM, pointed striped shield with stars, blue shield with a biplane, white shield with a sash and a bolt.",
  },
  {
    title: "Manchester",
    slugs: ["manchester-city", "manchester-united"],
    note: "Same city. City: sky-blue French shield with a navy three-masted ship and MCFC. United: red heater shield with a gold trident over a black wheel. Different colour, outline and symbol at every size.",
  },
  {
    title: "Two ships",
    slugs: ["manchester-city", "ipswich-town"],
    note: "Both use a ship, so they are drawn apart on purpose. City: a navy three-masted ship with nine white sails, heading right, on a sky-blue French shield with gold rivers. Ipswich: a white single-masted ship with two sails and a red pennant, on a blue oval. Different silhouette (three masts against one), colour (navy on sky against white on blue) and outline.",
  },
  {
    title: "Two lions",
    slugs: ["aston-villa", "chelsea"],
    note: "Not variations of one drawing. Villa: a whole lion rampant on the diagonal, with a curly mane and raised claws, in sky blue on a claret heater. Chelsea: only the head, in profile, with long flowing locks, in blue inside a white disc in a roundel.",
  },
  {
    title: "Sky blue",
    slugs: ["manchester-city", "coventry-city"],
    note: "Both sky blue. City is a French shield with a navy ship; Coventry a roundel with a white phoenix and orange flames.",
  },
  {
    title: "Red shields",
    slugs: ["arsenal", "manchester-united", "liverpool", "nottingham-forest"],
    note: "Four red crests. Arsenal and United now share the heater outline: Arsenal has a broad white border with a gold edge and white ARS and gun; United has a black edge, a black name band and a gold trident. Liverpool is a round-bottomed shield (white bird); Forest a French shield (white bow).",
  },
  {
    title: "Red stripes",
    slugs: ["brentford", "sunderland", "bournemouth"],
    note: "All striped. Brentford: red and white on a heater with a bee. Sunderland: red and white on an angular shield with a black cat. Bournemouth: red and black on a round-bottomed shield with cherries.",
  },
  {
    title: "Royal blue",
    slugs: ["chelsea", "everton", "ipswich-town", "brighton-and-hove-albion"],
    note: "Chelsea a roundel (lion's head), Everton a heater (tower), Ipswich an oval (ship), Brighton a heater with blue-and-white stripes (gull).",
  },
  {
    title: "Black and white",
    slugs: ["newcastle-united", "fulham"],
    note: "Newcastle: striped heater with a castle in a black disc. Fulham: white roundel with a black cottage.",
  },
  {
    title: "Navy and white",
    slugs: ["tottenham-hotspur", "leeds-united"],
    note: "Spurs: navy French shield with a white cockerel. Leeds: angular shield with a white rose and a yellow chevron.",
  },
];

function clashSection() {
  return CLASHES.filter((g) => g.slugs.every((s) => shownSlugs.has(s)))
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

const APPROACH = {
  competition: "Competition-inspired",
  cultural: "Cultural",
  brand: "Modern brand-inspired",
};

/** A file as a data: address (the gallery is one file), or undefined. */
function dataUrl(base) {
  for (const [ext, type] of [
    ["svg", "image/svg+xml"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ]) {
    const path = `${base}.${ext}`;
    if (existsSync(path)) return `data:${type};base64,${readFileSync(path).toString("base64")}`;
  }
  return undefined;
}

/** The mark shown for a league when it isn't TableTalk's own drawing: a
 *  licensed file, else supplied artwork (assets.ts uses the same order). */
function fileMark(slug) {
  for (const [folder, label] of [
    ["licensed", "Licensed official logo"],
    ["supplied", SUPPLIED_LABEL],
  ]) {
    const light = dataUrl(`src/identity/${folder}/marks/${slug}`);
    if (light) return { label, light, dark: dataUrl(`src/identity/${folder}/marks/${slug}-dark`) ?? light };
  }
  return undefined;
}

function leagueSection() {
  // For each league: the mark in use, then every other direction side by side.
  return LEAGUE_IDENTITIES.map((l) => {
    const name = LEAGUES.find((x) => x.id === l.leagueId).name;
    const file = fileMark(l.slug);
    const fileCell = file
      ? `<div class="option"><h4>${esc(file.label)} (the mark in use)</h4><div class="pair">${THEMES.map(
          (t, i) =>
            `<div class="theme ${t.cls} sizes">${[96, 40, 24, 20, 16]
              .map(
                (s, n) =>
                  `<img src="${i ? file.dark : file.light}" width="${s}" height="${s}" alt="${n ? "" : esc(`${name}: ${file.label}`)}">`,
              )
              .join("")}</div>`,
        ).join("")}</div>
${
  l.supplied
    ? `<p class="looks"><b>Source:</b> ${esc(l.supplied.provenance)}<br><b>Changes:</b> ${esc(l.supplied.changes)}</p>
<p class="res res-${l.supplied.resemblance.level}"><b>Resemblance to the competition's logo: ${l.supplied.resemblance.level}.</b> ${esc(l.supplied.resemblance.note)}</p>`
    : ""
}</div>`
      : "";
    const options = [
      {
        key: markKey(l),
        title: `${APPROACH[l.approach]}: ${l.title}${file ? "" : " (the mark in use)"}`,
        inspiration: l.inspiration,
        looks: l.looks,
        resemblance: l.resemblance,
      },
      ...l.alternatives.map((c, n) => ({
        key: define(`mark-${l.slug}-alt${n}`, renderCrest(c.mark, `m-${l.slug}-a${n}`)),
        title: `${APPROACH[c.approach]}: ${c.title}`,
        inspiration: c.inspiration,
        looks: c.looks,
        resemblance: c.resemblance,
      })),
    ];
    const cells = options
      .map(
        (o) => `<div class="option"><h4>${esc(o.title)}</h4><div class="pair">${THEMES.map(
          (t) =>
            `<div class="theme ${t.cls} sizes">${use(o.key, 96, `${name} mark, ${o.title}`)}${use(o.key, 24)}${use(o.key, 16)}</div>`,
        ).join("")}</div>
<p class="looks"><b>Idea:</b> ${esc(o.inspiration)}<br><b>What it shows:</b> ${esc(o.looks)}</p>
<p class="res res-${o.resemblance.level}"><b>Resemblance to the competition's logo: ${o.resemblance.level}.</b> ${esc(o.resemblance.note)}</p></div>`,
      )
      .join("");
    return `<article class="club"><header><h3>${esc(name)}</h3></header><div class="options">${fileCell}${cells}</div></article>`;
  }).join("");
}

function fallbackSection() {
  const examples = ["Hamburger SV", "Paris FC", "Deportivo La Coruña"];
  return `<div class="pair">${THEMES.map(
    (t) =>
      `<div class="theme ${t.cls} strip">${examples
        .map(
          (name) =>
            `<figure>${crestFor(name, 64)}${crestFor(name, 24)}${crestFor(name, 16)}<figcaption>${esc(name)}</figcaption></figure>`,
        )
        .join("")}</div>`,
  ).join("")}</div>`;
}

// Previous against current, from a snapshot.
function comparisonSection() {
  if (!args.previous) return "";
  const prev = JSON.parse(readFileSync(args.previous, "utf8"));
  const same = (a, b) =>
    a.replace(/"p-[a-z0-9-]+"|#p-[a-z0-9-]+/g, "") === b.replace(/"p-[a-z0-9-]+"|#p-[a-z0-9-]+/g, "");
  const changed = [];
  const unchanged = [];
  for (const club of SHOWN) {
    const was = prev.clubs[club.slug];
    if (!was) continue;
    const now = {
      full: renderCrest(club.full, `p-${club.slug}`),
      small: renderCrest(club.small, `p-${club.slug}-s`),
    };
    if (same(was.full, now.full) && same(was.small, now.small)) unchanged.push(club.name);
    else changed.push({ club, was });
  }
  const rows = changed
    .map(({ club, was }) => {
      const pf = define(`prev-${club.slug}-full`, was.full.replaceAll('"p-', '"q-').replaceAll("#p-", "#q-"));
      const ps = define(
        `prev-${club.slug}-small`,
        was.small.replaceAll('"p-', '"q-').replaceAll("#p-", "#q-"),
      );
      const cell = (cls) =>
        `<div class="theme ${cls} cmp"><div><p class="tname">Previous</p>${use(pf, 96)}${use(ps, 24)}${use(ps, 16)}</div><span class="arrow" aria-hidden="true">→</span><div><p class="tname">Refined</p>${use(crestKey(club, "full"), 96)}${use(crestKey(club, "small"), 24)}${use(crestKey(club, "small"), 16)}</div></div>`;
      const level =
        was.resemblance === club.resemblance.level
          ? `Resemblance: ${club.resemblance.level} (unchanged).`
          : `Resemblance: ${was.resemblance}, now <b>${club.resemblance.level}</b>.`;
      return `<div class="clash"><h3>${esc(club.name)}</h3><div class="pair">${cell("t-light")}${cell("t-dark")}</div><p class="looks"><b>Now:</b> ${esc(club.looks.full)} ${level}</p></div>`;
    })
    .join("");
  const changedMarks = LEAGUE_IDENTITIES.filter(
    (l) =>
      prev.marks[l.slug] &&
      !same(prev.marks[l.slug].replaceAll("pm-", "p-"), renderCrest(leagueMarkDesign(l), `p-${l.slug}`)),
  );
  const marks = changedMarks
    .map((l) => {
      const pk = define(
        `prev-mark-${l.slug}`,
        prev.marks[l.slug].replaceAll('"pm-', '"qm-').replaceAll("#pm-", "#qm-"),
      );
      return `<figure>${use(pk, 64)}<span class="arrow" aria-hidden="true">→</span>${use(markKey(l), 64)}${use(markKey(l), 24)}${use(markKey(l), 16)}<figcaption>${l.code}</figcaption></figure>`;
    })
    .join("");
  return `<section><h2>Previous and refined</h2>
<p>${changed.length} crests changed since the last review; ${unchanged.length} kept as they were: ${esc(unchanged.join(", "))}. Each row shows the previous full crest (96 px) and small crest (24 and 16 px), then the refined one, on the light and the dark theme.</p>
${rows}
${
  changedMarks.length > 0
    ? `<h3>League marks</h3><p>The previous mark, then the current one at 64, 24 and 16 px.</p>
<div class="pair"><div class="theme t-light strip">${marks}</div><div class="theme t-dark strip">${marks}</div></div>`
    : "<p>The league marks are unchanged since the last review; the new concepts to choose from are in the League marks section.</p>"
}
</section>`;
}

/** How each club's crest is composed, counted per league, so a league never
 *  drifts back to one arrangement. */
function compositionTable() {
  const withType = SHOWN.filter((c) => c.composition);
  if (withType.length === 0) return "";
  const counts = new Map();
  for (const c of withType) counts.set(c.composition, [...(counts.get(c.composition) ?? []), c.name]);
  const rows = [...counts]
    .sort((a, b) => b[1].length - a[1].length)
    .map(
      ([type, names]) =>
        `<tr><td>${esc(type)}</td><td class="num">${names.length}</td><td>${esc(names.join(", "))}</td></tr>`,
    )
    .join("");
  const shapes = new Map();
  for (const c of withType) {
    const shape = /k\.shield\("([\w-]+)"/.exec(String(c.full))?.[1] ?? "?";
    shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
  }
  const shapeList = [...shapes]
    .sort((a, b) => b[1] - a[1])
    .map(([sh, n]) => `${sh} ${n}`)
    .join(", ");
  return `<section><h2>Compositions</h2><p>How each crest is put together, so repetition is visible. No arrangement is used by more than a few clubs. Outlines used: ${esc(shapeList)}.</p>
<div class="scroll"><table><thead><tr><th>Composition</th><th>Clubs</th><th>Which</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function resemblanceTable() {
  const rows = SHOWN.slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td class="res-cell res-${c.resemblance.level}">${c.resemblance.level}</td><td>${(c.alternatives ?? []).map((a) => esc(a.title)).join(", ") || "none"}</td></tr>`,
    )
    .join("");
  const count = (lvl) => SHOWN.filter((c) => c.resemblance.level === lvl).length;
  return `<section><h2>Resemblance ratings</h2>
<p>${count("high")} high, ${count("medium")} medium, ${count("low")} low. Every high design has at least one alternative (a unit test checks). <b>These ratings are a design judgement, not legal advice, and approving the artwork is not legal clearance.</b> Any use of club names, colours or symbols on the public site is a separate decision.</p>
<div class="scroll"><table><thead><tr><th>Club</th><th>Resemblance</th><th>Alternatives</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function sizesTable() {
  const files = identityFiles();
  const kb = (n) => (n / 1024).toFixed(1);
  const size = (path) => {
    const text = files.get(path);
    return text ? [Buffer.byteLength(text), gzipSync(text).length] : [0, 0];
  };
  const rows = SHOWN.slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((c) => {
      const [f, fz] = size(`src/identity/crests/${c.slug}.svg`);
      const [s, sz] = size(`src/identity/crests/${c.slug}-small.svg`);
      return `<tr><td>${esc(c.name)}</td><td class="num">${kb(f)}</td><td class="num">${kb(fz)}</td><td class="num">${kb(s)}</td><td class="num">${kb(sz)}</td></tr>`;
    })
    .join("");
  const marks = LEAGUE_IDENTITIES.map((l) => {
    const [m, mz] = size(`src/identity/marks/${l.slug}.svg`);
    return `<tr><td>${esc(LEAGUES.find((x) => x.id === l.leagueId).name)} mark</td><td class="num">${kb(m)}</td><td class="num">${kb(mz)}</td><td></td><td></td></tr>`;
  }).join("");
  const all = [...files].filter(([p]) => p.endsWith(".svg"));
  const total = all.reduce((n, [, t]) => n + Buffer.byteLength(t), 0);
  const totalZ = all.reduce((n, [, t]) => n + gzipSync(t).length, 0);
  return `<section><h2>File sizes</h2>
<p>Each crest is a separate file, downloaded once and then cached for a year. Budgets (unit-tested): full crest 10 KB, small crest 3 KB, league mark 2 KB, before compression. All ${all.length} files together: ${kb(total)} KB, ${kb(totalZ)} KB compressed (gzip). A league page would load only its own clubs' small crests.</p>
<div class="scroll"><table><thead><tr><th>File</th><th>Full KB</th><th>Full gzip</th><th>Small KB</th><th>Small gzip</th></tr></thead><tbody>${rows}${marks}</tbody></table></div></section>`;
}

const covered = [...new Set(SHOWN.map((c) => c.leagueId))];
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
<p>${args.league ? `The ${esc(LEAGUES.find((l) => l.id === args.league)?.name ?? args.league)} crests, for this league's review` : "Every crest in the registry, for review"} before any page uses them. ${SHOWN.length} clubs shown (${CLUBS.length} drawn so far), ${SHOWN.reduce((n, c) => n + (c.alternatives?.length ?? 0), 0)} alternative designs. Each picture is also described in words.</p>
<ul class="chips"><li>Club crests: original drawings, no official artwork</li><li>Small crest at ${SMALL_MAX} px and below, full crest above</li><li>Light: Matchday · Dark: Floodlights</li><li>Not legal clearance</li></ul></header>
${status}
<section><h2>How to read this page</h2>
<ul>
<li><b>Sizes.</b> Each crest is shown at 120 px and 40 px (full crest) and at 24 px and 16 px (small crest), first on the light theme, then on the dark theme. 24 px is a fixture card; 20 px a standings row; 16 px the smallest planned use.</li>
<li><b>White keyline.</b> Every crest and mark has a thin white outline, so dark designs (Newcastle, Fulham, Spurs, the Bundesliga mark) stay visible on the dark themes.</li>
<li><b>Resemblance.</b> Every design is an original drawing. "Low", "medium" or "high" says how likely a supporter is to connect it with the official badge; every "high" design has at least one alternative. This is a design judgement, not legal clearance.</li>
<li><b>${dataLine}</b></li>
</ul></section>
${comparisonSection()}
<section><h2>League marks</h2><p>Up to three directions for each league, side by side. <b>${SUPPLIED_LABEL}</b>: the mark in use for the Premier League, Bundesliga, La Liga and Ligue 1 from 28 Nov, chosen by the owner. Not official or licensed files; their resemblance is recorded with each. <b>Competition-inspired</b> (chosen 27 Nov; the mark in use for Serie A): built on what supporters connect with the competition, drawn new. <b>Cultural</b>: an idea from the country's football culture. <b>Modern brand-inspired</b> (Premier League, Bundesliga, La Liga, Ligue 1): a standalone modern mark in the competition's design language. None of TableTalk's drawings copies or traces an official logo; the brand-inspired marks are deliberately closest in spirit, so their resemblance is high. Each is shown at 96, 24 and 16 px on the light and dark themes.</p>${leagueSection()}</section>
${covered
  .map((id) => {
    const league = LEAGUES.find((l) => l.id === id);
    return `<section><h2>${esc(league.name)}: standings preview</h2><p>The real table with the 20 px small crest in each row, as a league page would show it.</p>${standings(id)}</section>
<section><h2>${esc(league.name)}: fixture cards</h2><p>The next six matches with the 24 px small crest beside each team, and the model's chances.</p>${fixtures(id)}</section>`;
  })
  .join("")}
<section><h2>Clubs that could be confused</h2><p>Groups with similar colours, names or symbols, side by side: full crest at 64 px, small crest at 24 px and 16 px.</p>${clashSection()}</section>
${leagueClubs.join("")}
${compositionTable()}
${resemblanceTable()}
${sizesTable()}
<section><h2>The fallback crest</h2><p>A club with no entry in the registry yet (a newly promoted club, or a club renamed in the data) gets this instead of a broken image: a plain grey shield with a dashed inner line and up to three initials, clearly a placeholder and never a guess at its colours. The build prints a warning naming the club and carries on, so the nightly data publish is never blocked. The examples are clubs from leagues whose crests are not drawn yet.</p>${fallbackSection()}</section>
`;

const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TableTalk Crest Gallery</title>
<style>${FONTS}
:root { --bg:#f5f4ee; --surface:#fff; --border:#dfddd3; --text:#0e1a13; --muted:#4a5a50; --accent:#0a6b3b; --warn-bg:#fdf0d5; --warn:#5c3d00;
  --display:"Barlow Condensed","Arial Narrow",sans-serif; --body:"Source Sans 3","Segoe UI",system-ui,sans-serif; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0a1210; --surface:#111b17; --border:#26352e; --text:#edf3ef; --muted:#a0b0a6; --accent:#3fd98a; --warn-bg:#3a2c0c; --warn:#ffe2a3; color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#0a1210; --surface:#111b17; --border:#26352e; --text:#edf3ef; --muted:#a0b0a6; --accent:#3fd98a; --warn-bg:#3a2c0c; --warn:#ffe2a3; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family:var(--body); font-size:16px; line-height:1.5; padding-block:0; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }
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
.cmp { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.cmp > div { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.cmp .tname { width:100%; }
.arrow { font-size:1.6rem; opacity:.6; }
figure { margin:0; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
figcaption { font-size:.85rem; font-weight:600; width:100%; }
.notes li { margin-bottom:8px; }
.options { display:grid; gap:18px; }
.option { border-top:1px dashed var(--border); padding-top:12px; }
.option:first-child { border-top:0; padding-top:0; }
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
.res-cell { font-weight:700; border-left-width:5px; border-left-style:solid; }
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
.scroll .num { text-align:right; font-variant-numeric:tabular-nums; }
pre { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px; overflow-x:auto; font-size:.8rem; }
</style></head>
<body><svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...symbols.values()].join("")}</defs></svg>
<main>${body}</main></body></html>
`;

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, html, "utf8");
console.log(`wrote ${args.out}: ${symbols.size} pictures, ${Math.round(Buffer.byteLength(html) / 1024)} KB`);
