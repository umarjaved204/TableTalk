# TableTalk website

The website for TableTalk. It is built only from the files the nightly
pipeline publishes on the `data` branch, as described in
[`../contracts/README.md`](../contracts/README.md). It never imports or runs
the Python code.

- **Static site** built with [Astro](https://astro.build): every page is plain
  HTML with the numbers already in it. The only browser JavaScript is small
  scripts for the theme, the table controls, the phone tabs and local times.
- **No trackers, no analytics, no cookies, no third-party requests.** Fonts are
  self-hosted: Latin and Latin Extended only, as WOFF2 (`src/styles/fonts.css`). The visitor's theme and table choices are kept in their own
  browser (`localStorage`) only.
- **Content Security Policy** as a `<meta>` tag (the likely host, GitHub Pages,
  can't send headers). Only the site's own hashed scripts can run, so inline
  `style=""` attributes are not allowed anywhere.

## Status

Step 5 of the frontend plan (polish and tests): the full accessibility matrix,
a keyboard walk of every page, Lighthouse with speed budgets, no layout shift
while fonts and scripts load, and the deployment plan (`DEPLOYMENT.md`, not
carried out). Built on Steps 1-4: every page and every data state. Local preview only; no deployment and no workflows during the pipeline
trial. Work happens on the `frontend` branch; nothing goes on `main` until the
trial is reviewed (and contract request R8 is done).

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

| Command              | What it does                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run data`       | Copy the published files from `origin/data` into `web/.data/` (read-only: `git fetch` + `git cat-file`; never checks out or writes to `data`). Add `-- --offline` to skip the fetch |
| `npm run types`      | Regenerate `src/data/contract.gen.ts` from `../contracts/*.schema.json` (after a contract change)                                                                                   |
| `npm run dev`        | Development server (no CSP in dev mode)                                                                                                                                             |
| `npm run build`      | Type-check, build `dist/`, then check the build (`scripts/check-build.mjs`)                                                                                                         |
| `npm run preview`    | Serve `dist/` at http://localhost:4321 (with the CSP, as deployed)                                                                                                                  |
| `npm test`           | Unit tests                                                                                                                                                                          |
| `npm run test:e2e`   | Browser and accessibility tests. Builds its own test site from fixed test data first (see tests/README.md)                                                                          |
| `npm run lighthouse` | Lighthouse (mobile) on 5 pages of the built site, median of 3 runs; fails over budget (LCP 2.5 s, CLS 0.1, TBT 200 ms). Reports in `lighthouse/`                                    |
| `npm run lint`       | ESLint, Stylelint, Prettier check                                                                                                                                                   |
| `npm run format`     | Prettier, fix formatting                                                                                                                                                            |

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

| Page                 | What it shows                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | A card per league (title favourite, most at risk of relegation, play-off place where there is one), last update, track record line                                                |
| `/<league>/`         | Table and chances, next 10 matches, finishing positions, how the race has moved                                                                                                   |
| `/<league>/matches/` | Upcoming (next 4 weeks) and Recent (locked predictions from the last 4 weeks)                                                                                                     |
| `/track-record/`     | Locked predictions scored: counts, comparisons with base rates and the market, calibration (chart once there are enough matches), the latest 50 scored matches, the honesty rules |
| `/methodology/`      | How the model works, how to read the numbers, backtests per league (copied from the README, checked by a test), limitations                                                       |
| `/about/`            | Not betting advice, data sources (listed from the snapshots), privacy, source code                                                                                                |

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

## Nothing moves while the page loads

Measured with Lighthouse on a simulated slow phone (layout shift was 0.12 to
0.18 on two pages before, against a budget of 0.1). Two causes, two fixes:

- **Fonts swapping in.** While a web font downloads the browser shows a
  fallback, then swaps. The fallback is now Arial scaled to the web font's
  measured width and line height (`size-adjust` and the `-override`
  properties in `src/styles/fonts.css`, measured by
  `scripts/font-fallback-metrics.mjs`), so the swap barely moves anything.
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
