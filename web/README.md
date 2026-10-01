# TableTalk website

The website for TableTalk. It is built only from the files the nightly
pipeline publishes on the `data` branch, as described in
[`../contracts/README.md`](../contracts/README.md). It never imports or runs
the Python code.

- **Static site** built with [Astro](https://astro.build): every page is plain
  HTML with the numbers already in it. The only browser JavaScript is small
  scripts for the theme, the table controls, the phone tabs and local times.
- **No trackers, no analytics, no cookies, no third-party requests.** Fonts are
  self-hosted. The visitor's theme and table choices are kept in their own
  browser (`localStorage`) only.
- **Content Security Policy** as a `<meta>` tag (the likely host, GitHub Pages,
  can't send headers). Only the site's own hashed scripts can run, so inline
  `style=""` attributes are not allowed anywhere.

## Status

Step 2 of the frontend plan: design system plus the league pages built from
real data. Local preview only; no deployment and no workflows during the
pipeline trial. Work happens on the `frontend` branch; nothing goes on `main`
until the trial is reviewed (and contract request R8 is done).

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

| Command            | What it does                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run data`     | Copy the published files from `origin/data` into `web/.data/` (read-only: `git fetch` + `git cat-file`; never checks out or writes to `data`). Add `-- --offline` to skip the fetch |
| `npm run types`    | Regenerate `src/data/contract.gen.ts` from `../contracts/*.schema.json` (after a contract change)                                                                                   |
| `npm run dev`      | Development server (no CSP in dev mode)                                                                                                                                             |
| `npm run build`    | Type-check, then build `dist/`                                                                                                                                                      |
| `npm run preview`  | Serve `dist/` at http://localhost:4321 (with the CSP, as deployed)                                                                                                                  |
| `npm test`         | Unit tests                                                                                                                                                                          |
| `npm run test:e2e` | Browser and accessibility tests against the built site (run `build` first)                                                                                                          |
| `npm run lint`     | ESLint, Stylelint, Prettier check                                                                                                                                                   |
| `npm run format`   | Prettier, fix formatting                                                                                                                                                            |

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

See `CONTRACT_REQUESTS.md` for what the site needs from the contract, and
`tests/README.md` for what the tests cover.
