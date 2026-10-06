# TableTalk website

The website for TableTalk. It is built only from the files the nightly
pipeline publishes on the `data` branch, as described in
[`../contracts/README.md`](../contracts/README.md). It never imports or runs
the Python code.

- **Static site** built with [Astro](https://astro.build): every page is plain
  HTML with the numbers already in it. The only browser JavaScript is small
  scripts for the theme, the favourite team, the table controls, the phone
  tabs and local times.
- **No trackers, no analytics, no cookies, no third-party requests.** Fonts are
  self-hosted: Latin and Latin Extended only, as WOFF2 (`src/styles/fonts.css`). The visitor's theme, table choices and favourite team are
  kept in their own browser (`localStorage`) only.
- **Content Security Policy** as a `<meta>` tag (the likely host, GitHub Pages,
  can't send headers). Only the site's own hashed scripts can run, so inline
  `style=""` attributes are not allowed anywhere.

## Status

Website stage 2, Step 4 (the look), awaiting review. Steps 2 (favourite
teams) and 3 (team pages) are done. This was the stage's last step. Built on the first frontend
plan's Steps 1-5. Local preview only; no deployment and no workflows during
the pipeline trial. Work happens on the `frontend` branch; nothing goes on
`main` until the trial is reviewed (and contract request R8 is done).

Speed (Lighthouse, median of 3, simulated slow phone, today's data, 6 Oct
2026 after Step 4, nothing else running): with files gzip-compressed as a
real host serves them (`npm run lighthouse`, the default; the budgets apply
to this), every page is within budget: largest paint 1.5-1.8 s (budget 2.5 s),
layout shift 0.000-0.003 (budget 0.1), blocking time 1-110 ms (budget
200 ms); performance 97-100, accessibility 100. In the worst case, a host
that doesn't compress (`npm run lighthouse -- --uncompressed`), the matches
page is 57 ms over the 2.5 s largest-paint budget (before Step 4, the Premier
League page was 53 ms over). Blocking time depends on how busy the computer
is: run it with other servers and builds stopped (the same pages gave 0 ms
and over 300 ms on a busy machine).

## The site's address (one setting)

The public address is decided at deployment. It is one setting, the
`SITE_URL` environment variable, used only for each page's canonical link and
`og:url`:

```sh
SITE_URL=https://example.org npm run build
```

Without it those two tags are left out, never pointed at a local address. A
non-https value stops the build. After every `npm run build`,
`scripts/check-build.mjs` fails the build if any built file mentions
`localhost` or `127.0.0.1`, or if it ships a font other than the Latin and
Latin Extended WOFF2 files.

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

| Command              | What it does                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run data`       | Copy the published files from `origin/data` into `web/.data/` (read-only: `git fetch` + `git cat-file`; never checks out or writes to `data`). Add `-- --offline` to skip the fetch                                                        |
| `npm run types`      | Regenerate `src/data/contract.gen.ts` from `../contracts/*.schema.json` (after a contract change)                                                                                                                                          |
| `npm run dev`        | Development server (no CSP in dev mode)                                                                                                                                                                                                    |
| `npm run build`      | Type-check, build `dist/`, then check the build (`scripts/check-build.mjs`)                                                                                                                                                                |
| `npm run preview`    | Serve `dist/` at http://localhost:4321 (with the CSP, as deployed)                                                                                                                                                                         |
| `npm test`           | Unit tests                                                                                                                                                                                                                                 |
| `npm run test:e2e`   | Browser and accessibility tests. Builds its own test site from fixed test data first (see tests/README.md)                                                                                                                                 |
| `npm run lighthouse` | Lighthouse (mobile) on 6 pages of the built site (a team page among them), gzip-compressed, median of 3 runs; fails over budget (LCP 2.5 s, CLS 0.1, TBT 200 ms). `-- --uncompressed`: worst case, reported only. Reports in `lighthouse/` |
| `npm run lint`       | ESLint, Stylelint, Prettier check                                                                                                                                                                                                          |
| `npm run format`     | Prettier, fix formatting                                                                                                                                                                                                                   |

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
Security Policy allows it. An earlier version generated a rule for every team
into the site's CSS: about 25 KB of render-blocking CSS on every page, so it
was replaced.) A one-line inline script right after each `<template>` block
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

**Personal link** (`/?team=<slug>`): opening it asks before setting or
replacing the favourite, and the parameter is removed from the address bar
straight away. The link's text is only ever compared with the site's own team
list; it is never written into the page. The "Your team" dialog shows the link
with a Copy button and, once `SITE_URL` is set, a QR code made at build time
(`/qr/<slug>.svg`, `src/data/qr.ts`: black on white with a 4-module quiet zone,
error correction M).

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
element to the league page (see the star above): its DOM budget is unchanged.
The Your team dialog links "Bookmark your team's page".

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
the test data (budget 760).

**sitemap.xml and robots.txt** are built by `src/pages/[sitemap].xml.ts` and
`src/pages/robots.txt.ts`. The sitemap needs full addresses, so it is built
only when `SITE_URL` is set (as the QR codes are), and `robots.txt` then has
the `Sitemap:` line.

## The look (stage 2, Step 4)

The approved Step 1 plan's visual upgrade, with the same themes, tokens, data
colours and contrast rules:

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
  About 120 fewer elements; the budgets were lowered to match.
- **"Show the numbers" tables, one row per round of results** (`tableRows` in
  `src/data/race.ts`): updates between matchdays only add simulation noise,
  so a season has about 38 rows instead of about 250. The charts still plot
  every day.
- Team colour chips: not built (decided to wait for contract request R14).

## Browser support

**Supported:** the current and previous major versions of Chrome, Edge,
Firefox and Safari (macOS and iOS/iPadOS), Samsung Internet, and Firefox ESR.
In practice the site needs **Safari 16.4, Chrome/Edge 111, Firefox 121**
(December 2023) or later for everything to look as designed. The tests run in
Chromium (desktop and Android profiles) and WebKit (iPhone profiles).

**Modern features it relies on, and what happens without them:**

| Feature                                                                                       | Used for                                                                             | Without it                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Range media queries (`@media (width >= 900px)`)                                               | Every layout breakpoint                                                              | The phone layout at every width: one column, still complete                                 |
| Container queries (`@container`)                                                              | The header on phones when text is enlarged (links wrap, "Your team" on its own line) | At 200% text the header links scroll sideways instead of wrapping                           |
| `<dialog>` with `showModal()`                                                                 | The Appearance and Your team dialogs                                                 | The dialog opens in place, without the backdrop (scripted fallback; tested)                 |
| `:has()`                                                                                      | Hiding a match day left empty by "Your team only"                                    | The empty day's heading stays visible (tested)                                              |
| `color-mix()`                                                                                 | The favourite's row tint, dialog backdrop, lighter zone edge                         | The tint falls back to the striped-row colour; the star and accent rules still mark the row |
| CSS `mask`                                                                                    | The star icons                                                                       | No star; the hidden "your team" label and the row tint remain                               |
| `<template>`, `replaceChildren()`, `CustomEvent`, `URLSearchParams`, `history.replaceState()` | Favourite blocks and the personal link                                               | Favourites don't apply (the rest of the site works, as without JavaScript)                  |
| `navigator.clipboard`                                                                         | "Copy link"                                                                          | The link is selected for the visitor to copy (scripted fallback)                            |
| `text-wrap: balance`, `accent-color`, `display-mode` media query                              | Nicer headings, the checkbox colour, the home-screen note                            | Ordinary wrapping, the default checkbox, no home-screen note                                |

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
once the visitor's clock passes its kick-off. All the words are in
`src/format/match-status.ts`, used by both the build and the browser.

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
  noise. (On 1 Oct 2026 every run so far has results up to 20 Sep.)

**Build time** (measured 1 Oct 2026 on this laptop, `astro build` without the
type check; `npm run build` adds about 14 s of `astro check`):

| Data                                                      | History files read | Reading them | Whole build |
| --------------------------------------------------------- | ------------------ | ------------ | ----------- |
| Today (4 runs)                                            | 20                 | 0.1 s        | about 4 s   |
| A full season (300 runs, simulated by copying real files) | 1,500              | 2.2 s        | about 8 s   |

So each nightly run adds about 13 ms to the build, about 4 s over a season.
Each file is still parsed in full (150-190 KB); R2's compact series would
make this one small file per league.

Baseline before team pages (6 Oct 2026, commit 069ba57, today's data, median
of 3): `npm run build` about 23.5 s in all: `astro check` 18.5 s, `astro
build` 4.3 s (15 pages generated in 1.8 s), the build check 0.1 s.

With team pages (6 Oct 2026, same data, median of 3): `npm run build` about
22.3 s, the same within noise; `astro build` 4.6 s (111 pages generated in
2.0 s). The 96 team pages add about 0.3 s, because each league's files are
read once for all its team pages.

After Step 4 (6 Oct 2026, same data, median of 3, nothing else running):
`npm run build` 16.9 s, `astro build` 4.4 s. The build itself is unchanged
(4.3 s before team pages); the total is lower because `astro check` is
faster on an idle machine (12-14 s instead of 18), not because of the site.

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

Lighthouse results (2 Oct 2026, median of 3 runs, real data):

| Page                   | Performance | Accessibility | Best practices | SEO | LCP   | CLS   | TBT  |
| ---------------------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ---- |
| Home                   | 99          | 100           | 100            | 91  | 1.8 s | 0.001 | 0 ms |
| Premier League         | 97          | 100           | 100            | 91  | 2.1 s | 0.005 | 0 ms |
| Premier League matches | 97          | 100           | 100            | 91  | 2.1 s | 0.044 | 0 ms |
| Track record           | 99          | 100           | 100            | 91  | 1.7 s | 0.004 | 0 ms |
| Methodology            | 100         | 100           | 100            | 91  | 1.4 s | 0.002 | 0 ms |

SEO is 91 only because Lighthouse fetches `robots.txt` from inside the page,
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

See `CONTRACT_REQUESTS.md` for what the site needs from the contract, and
`tests/README.md` for what the tests cover.
