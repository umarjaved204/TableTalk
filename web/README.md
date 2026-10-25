# TableTalk website

The website for TableTalk. It is built only from the files the nightly
pipeline publishes on the `data` branch, as described in
[`../contracts/README.md`](../contracts/README.md). It never imports or runs
the Python code.

- **Static site** built with [Astro](https://astro.build): every page is plain
  HTML with the numbers already in it. The only browser JavaScript is small
  scripts for the theme, the favourite team, the table controls, the phone
  tabs and local times.
- **No trackers, no cookies, no analytics scripts, no third-party requests.**
  (The host, Cloudflare, counts requests on its own servers; see
  [the runbook](../docs/runbook.md#visitor-numbers-without-tracking).) Fonts are
  self-hosted: Latin and Latin Extended only, as WOFF2 (`src/styles/fonts.css`). The visitor's theme, table choices and favourite team are
  kept in their own browser (`localStorage`) only.
- **Content Security Policy** as a `<meta>` tag, because its script hashes
  change with every build. Only the site's own hashed scripts can run, so
  inline `style=""` attributes are not allowed anywhere. The other security
  headers, and the cache rules, are in `public/_headers`, sent by the host
  (Cloudflare Workers static assets, see [the runbook](../docs/runbook.md#deploying-the-website)).

## Status

Live at https://tabletalk.fyi since 22 Oct 2026, rebuilt and deployed by the
nightly run and on every website change on `main`
([the runbook](../docs/runbook.md#deploying-the-website)). Speed and page sizes
are measured on the live site once a month ([below](#monthly-live-check)). How
it got here: [the changelog](../CHANGELOG.md).

Measure speed with other servers and builds stopped: blocking time depends on
how busy the computer is (the same pages gave 0 ms and over 300 ms on a busy
machine).

## The site's address (one setting)

The public address is https://tabletalk.fyi. It is one setting, the
`SITE_URL` environment variable (set in `../.github/workflows/site.yml` for
every deploy), used for each page's canonical link and `og:url`, and needed
for the sitemap and `robots.txt`'s sitemap line:

```sh
SITE_URL=https://example.org npm run build
```

Without it those two tags are left out, never pointed at a local address. A
non-https value stops the build. After every `npm run build`,
`scripts/check-build.mjs` fails the build if any built file mentions
`localhost` or `127.0.0.1`, if it ships a font other than the Latin and
Latin Extended WOFF2 files, or if `_headers` is missing, loses a planned line
or would send any file two `Cache-Control` values.

## Setup

Needs **Node 24** (see `.nvmrc`; Astro 7 needs 22.12 or newer).

```sh
cd web
npm install
npx playwright install chromium   # only for the browser tests
```

`npm install` reports that esbuild's install script was approved in
`package.json` (`allowScripts`); esbuild is the bundler Vite uses.

Astro asks to collect anonymous usage data. To opt out on your machine:
`npx astro telemetry disable` (or set `ASTRO_TELEMETRY_DISABLED=1`).

## Everyday commands

**Before every commit, run `npm run verify`.** It runs the type check, lint,
the unit tests and the build (with the build check), in that order, and stops
at the first step that fails, with a non-zero exit code. Each step is judged
by its exit code only, so "it printed no errors" never counts as a pass. It
takes about a minute. The browser tests (`npm run test:e2e`, about 10
minutes) are separate.

| Command              | What it does                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run data`       | Copy the published files from `origin/data` into `web/.data/` (read-only: `git fetch` + `git cat-file`; never checks out or writes to `data`). Add `-- --offline` to skip the fetch                                                                                                                                                                                             |
| `npm run types`      | Regenerate `src/data/contract.gen.ts` from `../contracts/*.schema.json` (after a contract change)                                                                                                                                                                                                                                                                               |
| `npm run dev`        | Development server (no CSP in dev mode)                                                                                                                                                                                                                                                                                                                                         |
| `npm run verify`     | Before every commit: type check, lint, unit tests, build; stops at the first failure (non-zero exit)                                                                                                                                                                                                                                                                            |
| `npm run check`      | Type check only (`astro check`)                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build`      | Type-check, build `dist/`, then check the build (`scripts/check-build.mjs`)                                                                                                                                                                                                                                                                                                     |
| `npm run preview`    | Serve `dist/` at http://localhost:4321 (with the CSP, as deployed)                                                                                                                                                                                                                                                                                                              |
| `npm test`           | Unit tests                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run test:e2e`   | Browser and accessibility tests. Builds its own test site from fixed test data first (see tests/README.md)                                                                                                                                                                                                                                                                      |
| `npm run lighthouse` | Lighthouse (mobile) on 8 pages of the built site (one of each page type), gzip-compressed, median of 3 runs; fails over budget (LCP 2.5 s, CLS 0.1, TBT 200 ms) and reports each page's element count (no limit). `-- --uncompressed`: worst case, reported only. `-- --live https://tabletalk.fyi`: the live site instead (the monthly check, below). Reports in `lighthouse/` |
| `npm run lint`       | ESLint, Stylelint, Prettier check. Prettier accepts each file's own line endings (`endOfLine: "auto"`): this checkout has both CRLF and LF files, and the check must not fail on that alone                                                                                                                                                                                     |
| `npm run format`     | Prettier, fix formatting                                                                                                                                                                                                                                                                                                                                                        |

## Monthly live check

Once a month, measure the live site and add a column here:

```sh
npm run lighthouse -- --live https://tabletalk.fyi
```

It fails if a page misses a speed budget (LCP 2.5 s, CLS 0.1, TBT 200 ms) and
reports each page's element count (Lighthouse's DOM size) with no limit. The
counts replace the browser tests' per-page element budgets (removed 23 Oct
2026): those were measured on the test data, which the real pages outgrew, so
they passed in the tests while being false on the live site. Recording the
live counts shows growth without blocking it. Lighthouse counts at load, so
its numbers are not comparable with the old budgets.

Elements per page (live, median of 3 runs):

| Page                       | 23 Oct 2026 | 24 Oct 2026 |
| -------------------------- | ----------- | ----------- |
| `/`                        | 562         | 572         |
| `/premier-league/`         | 1,955       | 1,980       |
| `/bundesliga/`             | 1,887       | 1,917       |
| `/premier-league/matches/` | 1,951       | 1,956       |
| `/premier-league/arsenal/` | 680         | 687         |
| `/track-record/`           | 1,256       | 1,256       |
| `/methodology/`            | 322         | 322         |
| `/about/`                  | 222         | 219         |

The same run, 23 Oct 2026: performance 98-100, accessibility 100, best
practices 100, SEO 92 (the known `robots.txt` fetch, see
`scripts/lighthouse.mjs`); LCP 1.40-1.55 s, CLS 0.000-0.003, TBT 0-154 ms.

24 Oct 2026, the first check with the animations live (October's entry; 23
Oct is the record from before them): performance 99-100, accessibility 100,
best practices 100, SEO 92 (the same `robots.txt` fetch); LCP 1.41-1.84 s,
CLS 0.000-0.003, TBT 0-105 ms.

## How it fits together

```
../contracts/*.schema.json ──(npm run types)──▶ src/data/contract.gen.ts   (types)
origin/data ──(npm run data)──▶ .data/  ──▶ src/data/  (load, version check, validate, build models)
                                                │
                                   src/format/  (percentages, rounding, times, numbers: pure functions, Intl)
                                                │
                                   src/components/  (one job each) ──▶ src/pages/ ──▶ dist/
```

- `src/data/`: reading published files. `load.ts` checks the contract version
  **before** validating (a newer MAJOR is "unsupported": the page hides its
  numbers and says why); a file that breaks the contract stops the build.
  `league.ts` turns a snapshot into the site's own `LeagueData` model; components
  never see the raw contract types.
- `src/format/`: display rules. `probability.ts` holds the two probability
  rules (never 0%/100% without certainty; home/draw/away rounded together by
  the largest remainder method so they add to 100).
- `src/styles/`: the token system. `tokens/base.css` (type, space, radius,
  motion), `themes/<id>.css` (the only place interface colours live),
  `data-colours.css` (two sets, light and dark, never themed). Stylelint
  rejects raw colours anywhere else, and forbids the `font:` shorthand because
  it silently resets tabular figures.
- `src/scripts/`: browser scripts. `theme-head.js` runs first in `<body>` and is
  the only code that resolves a theme; its CSP hash is computed in
  `astro.config.mjs` from the same source, and `tests/e2e/csp.spec.ts`
  recomputes it from the built pages (a mismatch fails the tests).

## Pages

| Page                 | What it shows                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                  | The visitor's team (or a "Pick your team" prompt), "title races at a glance": a card per league with its top three for the title and for relegation (the favourite's league first), last update, track record line |
| `/<league>/`         | Table and chances, next 10 matches, finishing positions, how the race has moved                                                                                                                                    |
| `/<league>/matches/` | Upcoming (next 4 weeks) and Recent (locked predictions from the last 4 weeks)                                                                                                                                      |
| `/track-record/`     | Locked predictions scored: counts, comparisons with base rates and the market, calibration (chart once there are enough matches), the latest 50 scored matches, the honesty rules                                  |
| `/methodology/`      | How the model works, how to read the numbers, backtests per league (copied from the README, checked by a test), limitations                                                                                        |
| `/about/`            | Not betting advice, data sources (listed from the snapshots), privacy, source code                                                                                                                                 |
| `/<league>/<team>/`  | A team: record, projected points and chances, finishing positions, chances over time, next and recent matches (see Team pages). Last season's teams that left get a stub page                                      |
| `/sitemap.xml`       | Every real page (no stubs). Built only when `SITE_URL` is set; `/robots.txt` then points to it                                                                                                                     |

## Favourite team

A visitor can pick one favourite team. It is stored only in their browser
(`localStorage["tabletalk-favourite"]`, a small versioned JSON value; the
About page lists exactly what is stored and how to remove it). Without
JavaScript, favourites simply don't apply and the site is unchanged.

**How it shows without anything moving.** Everything that can differ per
team is built for every team at build time:

- Elements that already exist for every team (table rows, heatmap rows, match
  cards, race panels) carry `data-team="<slug>"` (match cards
  `data-teams="<home> <away>"`) and a hidden star and " (your team)" label.
  Where the name links to the team's page, the star is the link's `::before`
  rather than a `<span>` (`FavName.astro`), so the link costs no element.
- Blocks that exist only for the favourite (the home page's "Your team" card,
  the race chart's extra panel for a team outside the race) are pre-built
  inside `<template>` elements, which the browser parses but doesn't show or
  count as page elements.

The early script at the top of `<body>` (the one that sets the theme) reads
the favourite and sets `data-fav="<slug>"`, `data-fav-league` and
`data-fav-state` on `<html>` before the first paint, and writes one CSS rule
for that team into a constructed stylesheet (`favouriteCss()` in
`src/scripts/favourite-core.js`), which switches on its star and row tint.
(A constructed stylesheet is CSSOM, not an inline `<style>`, so the Content
Security Policy allows it. One rule written in the browser costs less than a
rule for every team in the site's CSS, which would be about 25 KB of
render-blocking CSS on every page.) A one-line inline script right after each `<template>` block
(`FavouriteSlot.astro`, `fillAll()`) copies the favourite's version in while the page is
still loading, so it is in place at the first paint. That's why the home
page's "Your team" space has no fixed height: a fixed height would have to fit
the tallest card (549px on a 320px phone) and leave a gap under the shorter
prompt. The only later size changes follow the visitor's own clicks, which
don't count as layout shift; the browser tests measure the shift in every
state.

**Team slugs** (`src/data/teams.ts`): made from the team's name, because the
published data has no team ids yet (contract request R14). "&" becomes "and",
accents are dropped, everything else becomes hyphens:
"Brighton & Hove Albion" → `brighton-and-hove-albion`. Tested against all 327
canonical names the pipeline knows: no two clash. The build fails on a clash
or on a slug that equals a page name (`matches`). If the pipeline ever renames
a team, `TEAM_SLUG_RENAMES` maps the old slug to the new one.

**No personal links.** A `?team=` parameter is ignored (personal links were
removed before the site was announced). To keep a team across devices,
bookmark its team page.

**Every state:** none (prompt), dismissed ("Not now"), chosen, paused (the
team's league has no data in this build: kept, not dropped), gone (the team
isn't in any covered league this season, e.g. relegated), newer (stored by a
newer site version: left alone), and storage blocked (applies for this page
view only, and the dialog says so).

**Home-screen app** (`public/manifest.webmanifest`, `display: standalone`):
on iPhone and iPad an app added to the home screen has its own storage,
separate from Safari, and is exempt from Safari's 7-day storage deletion. It
starts empty, so the prompt says to pick the team again there.

## Team pages

`/<league>/<team-slug>/`, one per team (96 today), built by
`src/pages/[league]/[team].astro` from `src/data/team-page.ts`:

- **Now and projected:** position, points, played, won-drawn-lost, goals,
  Proj. pts with its 80% range, and every zone's chance in plain words
  ("Top four (1st–4th) 95%").
- **Finishing position:** a bar per position over bands shading the table's
  zones (the innermost zone, as the table's row markers do), "Most likely:
  2nd (42%)", and a "Show the numbers" table. SVG drawn at build time, heights
  as attributes (the CSP allows no `style=""`).
- **Chances over time:** the race charts' rules (one point per day this
  season; "too early" until the updates cover 3 different result dates). One
  panel per Your-team-card zone on a shared scale, plus projected points.
- **Next and recent matches:** up to 5 each, as match cards.
- **Breadcrumb** (Home › League › Team): a navigation landmark, the current
  page marked `aria-current="page"`.
- Title, description and Open Graph per page ("Arsenal in the Premier League
  2026-27: 2nd with 12 points from 5 matches, projected 79 points. Chances:
  …").

**Every data state.** When a league has no numbers in a build (unavailable,
or a newer format), its team pages still exist, so bookmarks and home-screen
links keep working: the team list comes from the newest readable history run,
and the page shows the same notice as the league page. That league page then
lists its teams as links.

**Links.** Team names link to their pages from the league table, the heatmap,
the race panels, every match card and the Your team card. A name is a link
only when the page exists (`teamHref()`). Linking every name added no
element to the league page (see the star above).
The Your team dialog links "Bookmark your team's page".

**Choosing a team from its page.** Under a team page's heading, "Make this
my team" saves the team in one press. When it is the favourite, the same
button reads "Your team · Change" and opens the Your team dialog. Both labels
are in the button; the favourite's rule from `favouriteCss()` sets
`--fav-unmark: none` as well as `--fav-mark`, so the right label shows from
the first paint. The line under the button says what the press did (it can
replace another team); it is `aria-hidden`, because screen readers already
hear the same words from the page's status region.

**The team picker** (`src/scripts/team-picker.ts`). The Your team dialog
shows a button per league, then that league's teams as native radio buttons
in a `<fieldset>` named by its `<legend>`: two columns on a phone, four in
the desktop dialog, one at 200% text. It opens on the page's league, else
the favourite's, else the first (`openingLeague()` in
`team-picker-core.ts`); the home page's prompt has a button per league that
opens it on that league. Arrow keys check each radio as they move, so only
Save saves. It is built the first time the dialog opens, with
`createElement` only, so pages carry none of it. All radios share one name;
Chromium leaves the hidden leagues out of the count ("2 of 18", not "of
96"). Only the middle of the dialog scrolls, so the footer with Save never
covers a focused team. A name whose longest word doesn't fit its tile
(Borussia Mönchengladbach, and Bournemouth by 4 px, on a 360px phone) spans
two columns, so it breaks only between words; `fit()` measures this each
time a league is shown or the window resizes.

**Stub pages for last season's teams.** A team that left the covered leagues
keeps its address: a short page says it isn't covered this season ("It was in
the Premier League in 2026-27"), with the breadcrumb and links back. Stubs are
`noindex` and not in the sitemap. Until contract request R15, the list is
worked out from the history folders: per league, the teams in the last run of
the newest earlier season that have no page this season. Today there are none
(history has 2026-27 runs only); the rollover test has four.

**The home-screen app.** The manifest uses `display: standalone`, so on an
iPhone the app has no back button and no address bar. Every page can be left
with the site's own links (the header's TableTalk link on every page, the
breadcrumb on team pages, the league links), and every page can be reached
from the home page. `tests/e2e/navigation.spec.ts` walks the built site from
`/` following only links to check this; the real-phone pass in
`docs/accessibility-review.md` checks it by hand.

**Cost.** All the team pages of a league read the same files, so each
league's data, history and the track record are read once per build, not once
per page (cached in `team-page.ts`). Team pages are 208 to 710 elements on
the test data, more on real data (see the monthly live check).

**sitemap.xml and robots.txt** are built by `src/pages/[sitemap].xml.ts` and
`src/pages/robots.txt.ts`. The sitemap needs full addresses, so it is built
only when `SITE_URL` is set, and `robots.txt` then has
the `Sitemap:` line.

## The look

On top of the themes, tokens, data colours and contrast rules:

- **Title races at a glance** (`LeagueCard.astro`, `src/data/home.ts`): each
  home card shows the three teams most likely to win the title and the three
  most likely to be relegated (the direct places), each with its chance and a
  mini bar. Always three, so every card is the same height. The number is
  always printed; the bar is decorative. Title bars use the table's top-zone
  blue, relegation bars its bottom-zone red with a dashed fill (a shape cue,
  not colour alone). The play-off place is on the league pages only.
- **Scoreboard numbers:** the display face, bold, equal-width digits, "%" at
  half size. On team pages they sit in tiles with a solid top rule in the text
  colour ("Now and projected", "Chances"); the Your team card uses the same
  digits. Text colour only, never a data colour.
- **Motion, only if allowed:** the home mini bars grow in from the left (0.6 s,
  staggered by at most 120 ms) and the team page's finishing bars grow up,
  once, inside `prefers-reduced-motion: no-preference`. A transform only, so
  nothing else moves; every number is in the HTML from the first frame.
- **Lighter league page:** the race panels reuse one drawing of the race's
  faint lines (`<use>`) instead of drawing them in every panel, and runs of
  blank heatmap cells are one cell each (`heatCells` in `src/format/heat.ts`).
  About 120 fewer elements.
- **"Show the numbers" tables, one row per round of results** (`tableRows` in
  `src/data/race.ts`): updates between matchdays only add simulation noise,
  so a season has about 38 rows instead of about 250. The charts still plot
  every day.
- Team colour chips: not built (waiting for contract request R14).

## Browser support

**Supported:** the current and previous major versions of Chrome, Edge,
Firefox and Safari (macOS and iOS/iPadOS), Samsung Internet, and Firefox ESR.
In practice the site needs **Safari 16.4, Chrome/Edge 111, Firefox 121**
(December 2023) or later for everything to look as designed. The tests run in
Chromium (desktop and Android profiles) and WebKit (iPhone profiles).

**Modern features it relies on, and what happens without them:**

| Feature                                                          | Used for                                                                             | Without it                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Range media queries (`@media (width >= 900px)`)                  | Every layout breakpoint                                                              | The phone layout at every width: one column, still complete                                 |
| Container queries (`@container`)                                 | The header on phones when text is enlarged (links wrap, "Your team" on its own line) | At 200% text the header links scroll sideways instead of wrapping                           |
| `<dialog>` with `showModal()`                                    | The Appearance and Your team dialogs                                                 | The dialog opens in place, without the backdrop (scripted fallback; tested)                 |
| `:has()`                                                         | Hiding a match day left empty by "Your team only"                                    | The empty day's heading stays visible (tested)                                              |
| `color-mix()`                                                    | The favourite's row tint, dialog backdrop, lighter zone edge                         | The tint falls back to the striped-row colour; the star and accent rules still mark the row |
| CSS `mask`                                                       | The star icons                                                                       | No star; the hidden "your team" label and the row tint remain                               |
| `<template>`, `replaceChildren()`, `CustomEvent`                 | Favourite blocks                                                                     | Favourites don't apply (the rest of the site works, as without JavaScript)                  |
| `text-wrap: balance`, `accent-color`, `display-mode` media query | Nicer headings, the checkbox colour, the home-screen note                            | Ordinary wrapping, the default checkbox, no home-screen note                                |
| Cross-document view transitions (`@view-transition`)             | Pages crossfade (180 ms) between pages of the site (Chrome/Edge 126, Safari 18.2)    | The page changes instantly (Firefox today, and with reduced motion)                         |

Without JavaScript at all, every page shows all its numbers; the controls
that need JavaScript (tabs, table switch, favourites) are hidden.

## Matches: where each status comes from

`src/data/match-records.ts` replays `track_record/locks.jsonl` in order, per
match id: `lock` makes the match **locked**; `void` makes it **voided**
(postponed, suspended, cancelled, removed); `invalid` makes it **not counted**
(made after the actual kick-off); `missed` is **not counted** (no prediction
in time). A match in `summary.json`'s `matches[]` is **played**, with its
score. A postponed match that gets a new lock shows the new lock, with a note
about the voided one. Anything that breaks these rules (a void for a lock that
doesn't exist, a second lock without a void) stops the build.

`src/data/matches.ts` then splits them: **Upcoming** is the snapshot's matches
minus any the log says have started; **Recent** is the log's matches for the
league. Matches played before recording started, or never locked, are in no
published file (contract request R5), so Recent shows locked matches only and
says so. In the browser, `local-times.ts` marks an upcoming match **kicked off**
once the visitor's clock passes its kick-off. A match the fixture source lists
as postponed or cancelled is never marked kicked off, even though it keeps its
old kick-off time: its line says nothing locks until it is rescheduled (the
real case: Rayo Vallecano v Athletic Bilbao, cancelled on 10 Oct 2026). All the
words are in `src/format/match-status.ts`, used by both the build and the
browser.

## How the race has moved

Built at build time from the `history/` folders (until contract request R2),
keeping only each team's projected points and zone chances. It is drawn as SVG
at build time with no chart library and no browser JavaScript, as small
multiples: one small panel per team, headed with its name, the other teams in
the same race as faint lines behind. Every chart has a "Show the numbers" table.

- **Which teams:** title chart, teams whose title chance reached 10% at any
  point; relegation chart (the direct places, not the play-off place), teams
  whose chance reached 20%; projected points, the teams on those two charts.
  At most 6 per chance chart. Constants in `src/data/race.ts`.
- **One point per day:** the last run of each UTC day, current season only.
  The "Show the numbers" table has one row per round of results instead (the
  last update with each "results up to" date).
- **Too early:** the charts appear once the runs cover results up to **3
  different dates**. Runs with the same results differ only by simulation
  noise.

**Build time** (measured 1 Oct 2026 on this laptop, `astro build` without the
type check; `npm run build` adds about 14 s of `astro check`):

| Data                                                      | History files read | Reading them | Whole build |
| --------------------------------------------------------- | ------------------ | ------------ | ----------- |
| Today (4 runs)                                            | 20                 | 0.1 s        | about 4 s   |
| A full season (300 runs, simulated by copying real files) | 1,500              | 2.2 s        | about 8 s   |

So each nightly run adds about 13 ms to the build, about 4 s over a season.
Each file is still parsed in full (150-190 KB); R2's compact series would
make this one small file per league. The 96 team pages add about 0.3 s,
because each league's files are read once for all its team pages; most of
`npm run build` is `astro check` (12-18 s).

## Nothing moves while the page loads

Measured with Lighthouse on a simulated slow phone (layout shift was 0.12 to
0.18 on two pages before, against a budget of 0.1). Two causes, two fixes:

- **Fonts arriving late.** The fonts use `font-display: optional`: the browser
  waits about 100 ms for a web font, and if it hasn't arrived, the fallback is
  used for that page view and the font from the next page (cached by then). A
  font never swaps in after the page has appeared. (With `swap`, a late font
  moved the header and table columns sideways and, on a phone, re-wrapped the
  track record page: a shift of 0.17 with the fonts 1.5 s late.) The three
  fonts used at the top of every page are preloaded, so they usually arrive
  in time. The fallback is Arial scaled to the web fonts' measured width and
  line height (`size-adjust` and the `-override` properties in
  `src/styles/fonts.css`, measured by `scripts/font-fallback-metrics.mjs`), so
  a page shown in it looks almost the same.
- **The out-of-date warning.** Numbers older than 30 hours are flagged by the
  early script before the first paint (`staleCss` in
  `src/scripts/favourite-core.js`): one CSS rule styles that "Updated" line as
  a warning and adds "(2 days ago): these numbers may be out of date". It was
  text rewritten after load, which pushed the page down on phones.
  `tests/e2e/layout-shift.spec.ts` checks both with every font 1.5 s late.
- **Controls appearing late.** The phone tabs and the table's Short/Full
  switch need JavaScript, so they were hidden until the scripts ran, and then
  pushed the page down. The theme script (which already runs before the first
  paint) now marks the page with `data-js`, and CSS shows them from the first
  paint. Without JavaScript they stay hidden (`tests/e2e/no-js.spec.ts`).
- Also: the times the browser rewrites in the visitor's zone change length,
  so on phones each "Updated" fact has its own line and can't re-wrap.

Lighthouse's SEO score is 91-92 only because Lighthouse fetches `robots.txt` from inside the page,
which the Content Security Policy (`connect-src 'none'`) blocks; search
engines fetch it directly. INP needs real visitors' clicks, so a lab run
reports total blocking time (TBT) instead.

## Track record page: two display decisions

`src/data/track-record-view.ts` arranges `summary.json`; the scoring itself is
the pipeline's. The site decides only:

- **Too few to judge.** Each comparison has `matches_needed` (roughly how many
  matches it takes to detect a gap the size the backtest found: 0.08 in log
  loss against base rates, 0.02 against the market). Below it, the page says
  so in a sentence, so "no detectable difference" reads as "not enough matches
  yet".
- **The calibration chart** appears once the all-leagues comparison with base
  rates reaches its `matches_needed`; before that, the table only.

Every difference is shown as difference ± 95% interval; if the interval
includes zero the verdict shown is "no detectable difference", whatever the
file says (`displayVerdict` in `src/format/track-record.ts`).

What the site needs from the contract is in the GitHub issues labelled
`contract`; each title starts with the request's id ("R14: ..."), which the
code's comments use. What the tests cover: `tests/README.md`.
