# TableTalk UI audit

Review only. No site code was changed for this audit, and nothing here has been built yet.

## Reproducibility

| What | Value |
| --- | --- |
| Audit date | 10 Nov 2026 |
| Site code audited | `main` at `1def782` |
| Forecast data used | Local `origin/data` at `fc665040a1af6336b3843befeed00e123460b2db`, published 27 Oct 2026. Not refreshed, so the out-of-date warnings in the screenshots are real behaviour for data of that age |
| Empty and error states | Local fixture build `web/dist-e2e`, built 26 Oct 2026. Served locally, never against the live site |
| Pinned rules URL | `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/434b7f91364665f2f733b310ec54809bf8f37937/command.md` |
| Pinned rules commit | `434b7f91364665f2f733b310ec54809bf8f37937` |
| Pinned rules copy | `$HOME\Downloads\web-interface-guidelines-pinned.md`, 8,055 bytes, SHA-256 `D246B026F4F29B5823A9CC857F9EDF3D2507002E055E32040CADEAF3B38E0234` |
| `frontend-design` skill | `anthropics/skills` at `2c5958ecac7cee2b583967a2c4981d0f4a75c579` |
| `web-design-guidelines` skill | `vercel-labs/agent-skills` at `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62`, used with the pinned rules above instead of its live fetch |
| Review decisions | 10 Nov 2026, agreed with the project owner |

**How it was tested.** Six pages (home, Premier League, Arsenal, Premier League matches, track record, methodology) at 360, 768 and 1280 px, in Chromium, with JavaScript on and no saved settings, as a first-time visitor. That is 36 page captures.

**Themes.** The default theme is System, which depends on the device. Both of its results were tested: Floodlights (a device in dark mode) and Matchday (a device in light mode, and the light theme for this audit).

**What passed on all 36 captures.** No sideways page scroll, no axe violations (WCAG 2.0 to 2.2 A/AA plus best-practice tags), no console errors or CSP violations, and no request to any third-party origin. The findings below are about clarity and design, not breakage.

**Not checked.** Real phones, screen readers, Safari and Firefox. The other 6 themes. Lighthouse was not re-run, because nothing changed. Each proposed fix still needs its own contrast, Lighthouse and bundle check when built. Facts about results (such as "too few to judge") are from the 27 Oct data.

## 1. Top 10 findings

Ranked by impact on a first-time visitor. Sizes: S is under half a day, M is about a day, L is more.

### 1. The home page never says what a percentage means

- **Where:** `web/src/pages/index.astro:55-56` and `:66`, `web/src/components/LeagueCard.astro:29-33`
- **Screenshot:** `audit-shots/home-1280-matchday-full.png`
- **What a visitor sees:** "Arsenal 47%" under "Title race". The only clue is "10,000 simulated seasons per league" in small muted text. The H1 repeats the logo ("TableTalk") directly below it, so the most prominent line on the page explains nothing.
- **Proposed fix:** Make the H1 say what the site is ("Season forecasts for five leagues"), and leave the brand to the logo. Change the lede to one plain sentence built from the existing simulation count: "Season chances are the share of 10,000 simulated seasons that ended that way. Updated every night." This covers season chances only, because the team card also shows next-match chances, which come from the match model, not from simulated seasons. Add a link, "How to read the numbers", to the existing `/methodology/#reading`. The PR must confirm from the code where every home-page percentage comes from.
- **Size:** S
- **Constraints:** None broken. The sentence must be left out when leagues use different simulation counts, as the current line already is. Lines must not reflow after the first paint (Lighthouse CLS).

### 2. On a phone, the first forecast is below the first screen

- **Where:** `web/src/pages/index.astro:92-157` (prompt, placed before the cards at `:159`)
- **Screenshot:** `audit-shots/home-360-floodlights-fold.png`
- **What a visitor sees:** At 360 × 740 the "Pick your team" prompt fills the screen. The first percentage starts at 787 px, so a new visitor is asked to personalise a site before seeing what it does.
- **Proposed fix:** Show the not-yet-chosen prompt after the league cards. A chosen team's card stays at the top, as it does now. Use a second slot in the markup rather than CSS `order`, so keyboard order still matches what is on screen.
- **Size:** M
- **Constraints:** CLS budget, as the slot is filled before first paint and `tests/e2e/favourites.spec.ts` measures shift. This keeps your decision to keep the home card: only the unchosen prompt moves, and its five league buttons stay.

### 3. The home track-record line is jargon and shows only one of two comparisons

- **Where:** `web/src/format/track-record.ts:87`, shown at `web/src/pages/index.astro:167-171`
- **Screenshot:** `audit-shots/home-1280-matchday-full.png`
- **What a visitor sees:** "Against base rates: model better (log loss difference −0.112 ± 0.057)." A visitor doesn't know base rates, log loss, or that negative is good. The market comparison, which on this data was "too few to judge", appears only on the track record page, so the home page shows only the favourable half.
- **Proposed fix:** Plain words, both comparisons, the number left to the track record page: "144 matches scored. Compared with league-average forecasts: model better. Compared with bookmakers' odds: too few to judge so far." Use the existing verdict wording (`displayVerdict`, `sampleSentence`) rather than new claims, and leave out the market half when it has no result yet.
- **Size:** S
- **Constraints:** Your standing wording rule: never "beats", and "no detectable difference" when the interval includes 0. The same function feeds `web/src/pages/track-record.astro:105`, so decide whether that line changes too. No data contract change.

### 4. A phone league page has four layers of navigation before the table

- **Where:** `web/src/pages/[league]/index.astro:63`, `:88`, `:91-100`, `web/src/components/LeagueTable.astro:34-50`
- **Screenshot:** `audit-shots/league-360-floodlights-fold.png`
- **What a visitor sees:** Header, league chips, page tabs, section tabs, panel heading, then the view controls. "Table and chances" appears twice and "Table" once within about 150 px. The first table row starts at 745 px, just below a 740 px screen.
- **Proposed fix:** Below 900 px with JavaScript on, hide the panel heading visually and keep it for screen readers, because the selected tab already names the section. Put Short/Full and "Chance shown" on one row at 360 px. That should bring several rows onto the first screen.
- **Size:** M
- **Constraints:** CLS: the decision must stay in CSS before first paint (`data-js`). Without JavaScript and at 900 px and up, the heading must stay visible.

### 5. The explanations are the smallest text and come after the data

- **Where:** `web/src/components/LeagueTable.astro:154-161` and `:446-452`, `:99` (`abbr` titles), `web/src/pages/[league]/[team].astro:412-416`, `web/src/pages/[league]/matches.astro:195-200`, `web/src/components/MatchList.astro:63-67`, `web/src/components/FinishingChart.astro:134`
- **Screenshot:** `audit-shots/league-768-floodlights-full.png`
- **What a visitor sees:** At 360 px the table starts at 745 px and the definition of "Chances" at 1,667 px, set at 13.44 px in muted colour. That size accounts for about 95% of text nodes on the league page at 1280 px. Column heads such as "Down" are explained only by `abbr` titles, which touch screens can't show.
- **Proposed fix:** Move the one-sentence "Chances are the share of simulated seasons…" above the table. Keep the colour key below it. Set explanatory paragraphs (`.key`, `.note`, `.intro`) at `--step-0` (16 px). Leave table cells at 13.44 px.
- **Size:** S
- **Constraints:** Change only these paragraphs, not `--step--1`, since the 1200 px full-table fit and header height tests depend on it. No colour change. Check CLS.

### 6. Match cards use terms nobody has explained

- **Where:** `web/src/components/MatchCard.astro:93-98` and `:114-124`, key to go in `web/src/components/MatchList.astro:28-33`
- **Screenshot:** `audit-shots/matches-1280-matchday-fold.png`
- **What a visitor sees:** "Home 46%" beside "Most likely 1–1 (11%)" looks like a contradiction, as a draw is the likeliest score while a home win is the likeliest result. "Expected goals 1.8–1.4" and the ✓ are also unexplained.
- **Proposed fix:** One key per list, in the note already shown above each list: "Home, Draw and Away are the chance of each result. Most likely is the single likeliest score, which can be a draw even when one team is favoured. ✓ marks what happened."
- **Size:** S
- **Constraints:** CLS: the note is deliberately built from fixed lines (`MatchList.astro:25-27`). The new text is static, so it doesn't change height after paint.

### 7. The track record page buries its answer

- **Where:** `web/src/pages/track-record.astro:82-90`, `:104-105`, `:277-345`, `web/src/data/track-record-view.ts:20`
- **Screenshot:** `audit-shots/track-record-360-floodlights-fold.png`
- **What a visitor sees:** Five lines of process before any result, and then the jargon line from finding 3. At 360 px the page is 11.8 screens long. The 50-row scored list starts at 4,038 px and pushes "How the record is kept honest" to 7,232 px.
- **Proposed fix:** Lead with two plain verdict statements (from finding 3), then the method. Show the 10 newest scored matches, with the other 40 inside a `<details>`, matching the "Show the numbers" pattern used elsewhere. Move "How the record is kept honest" above the scored list.
- **Size:** M
- **Constraints:** No loss of published information: all 50 rows stay on the page. The wording rule applies. No data contract change.

### 8. The header gives Appearance more weight than the content

- **Where:** `web/src/components/SiteHeader.astro:40-45`, `:91-93`, `:150-156`, `:13-16`, `web/src/components/ThemePicker.astro:60-76`
- **Screenshot:** `audit-shots/team-360-floodlights-full.png`
- **What a visitor sees:** At 360 px the header is two rows and 113 px, and the largest control is Appearance, while Track Record and Methodology are 13.44 px. The track record and methodology pages have no link to any league, only the logo back to home.
- **Proposed fix:** Below 800 px, make Appearance icon-only, with its label kept for screen readers, at the same 44 px target. Evaluate one row once it is smaller. Add the existing `LeagueLinks` component to the end of track record and methodology.
- **Size:** M
- **Constraints:** CLS: the header's height is tested across fonts at 320 to 1400 px (`favourites.spec.ts`). The dialog and all 8 themes are unchanged.

### 9. Warning and failure states repeat themselves and speak in system terms

- **Where:** `web/src/components/UpdatedStamp.astro:96-98`, `web/src/pages/index.astro:57-65` and `:85`, `web/src/components/LeagueCard.astro:81-91`, `web/src/components/LeagueUnavailable.astro:16`, `:21-26`, `web/src/components/UpdatedStamp.astro:78`, `web/src/scripts/favourite-core.js:218`
- **Screenshots:** `audit-shots/home-360-floodlights-full.png` and `audit-shots/state-home-1280-matchday-full.png`
- **What a visitor sees:** When numbers are out of date the same amber warning appears 6 times on the home page. Failure messages mention "contract 2.0.0", "its published file", and the raw recorded error, and give no next step. A failed league's card still offers two links to pages with no forecast. The out-of-date warning itself is CSS `::after` text, so it is absent from `innerText` and copy.
- **Proposed fix:** Show the warning once at the top, and on a card only when that league's age differs. Make the warning real text that screen readers announce, still decided before first paint so there is no layout shift, because the stale warning is part of keeping every statement on the site true. Rewrite the failure copy in visitor terms: what is missing, that the other leagues are fine, and that updates run nightly. Stop printing the contract version and raw error to visitors. Link failed-league cards to the league page only. Loading states are not needed: pages are static and arrive complete.
- **Size:** S
- **Constraints:** CLS: the stale state is decided before first paint (`staleCss`, `web/src/scripts/favourite-core.js:205`). The warning must remain visible when numbers are stale, so the "every statement stays true" rule still holds.

### 10. Small spacing and alignment faults

- **Where and fix, one line each:**
  - `web/src/components/LeagueSwitcher.astro:52`: on phones the first chip touches the screen edge. Scroll-snap moves the list by 16 px (measured: `scrollLeft` 16, chip at x = 0). Add `scroll-padding-inline: var(--gutter)`.
  - `web/src/components/LeagueCard.astro:111-117`: at 1280 px "Premier League 2026-27" wraps and only that card's rows sit 17 px lower. Always put the season on its own line.
  - `web/src/components/TeamTrend.astro:159`: `auto-fill` leaves about 47% of the panel empty at 1280 px (4 panels of 157 px in 1,198 px). Use `auto-fit`, and check chart height at the new width.
  - `web/src/pages/methodology.astro:356`: cards are 1,232 px wide with 596 px of text. Cap the card width to match the text.
  - `web/src/components/FinishingChart.astro:126`: the heading has no divider, unlike the other team-page panels.
- **Screenshots:** `audit-shots/league-360-floodlights-fold.png`, `audit-shots/team-1280-matchday-full.png`, `audit-shots/methodology-1280-matchday-fold.png`
- **Size:** S
- **Constraints:** Tests assert the home card rows at each width. Otherwise none.

## 2. Everything else from the checklist

Grouped as in the pinned rules. "Pass" means no problem found in the code or the captures.

**Accessibility:** pass (axe clean on all 36; skip link `web/src/layouts/Base.astro:78`; headings in order).

**Focus:** pass. `:focus-visible` is global (`web/src/styles/global.css:112`). `main:focus` has no outline (`:117-118`), which is correct for a skip-link target. No sticky bar covers focus.

**Forms:** mostly pass.
- `web/src/components/LeagueTable.astro:44`: select has no `name`. Harmless, as nothing is submitted.

**Animation:** pass. No `transition: all`; off under reduced motion. Your animation work was not re-audited frame by frame.

**Typography:**
- About 21 lines of visible copy use straight apostrophes, sometimes beside curly quotes (`web/src/pages/index.astro:98`, `web/src/pages/methodology.astro:147`).
- No non-breaking spaces, so "Ligue 1" and "Serie A" can split across lines.
- `text-wrap: balance` covers headings only (`global.css:76`); body has no `pretty`.

**Content handling:** pass. Long names wrap; empty lists have messages.

**Images:** pass. No `<img>` in the source; SVGs are sized.

**Performance:**
- The matches page has 2,325 DOM elements and the league page 2,039.
- `web/src/components/LeagueSwitcher.astro:34-35`: one layout read on load, harmless.

**Navigation and state:**
- `web/src/scripts/tabs.ts:20` and `:57`: `#positions` works on arrival, but clicking a tab doesn't change the address (measured), so it can't be shared. `history.replaceState` would fix it.
- `web/src/scripts/table-controls.ts:15` and `:22`: table view is kept in storage, not the URL. Fine as a preference.
- `web/src/components/FavouritePicker.astro:79`: "Remove my team" acts at once with no undo. Low stakes, and it confirms in the status region.

**Touch:** tap highlight is set (`global.css:43`); the team dialog contains its scroll.
- No `touch-action: manipulation` anywhere.
- `web/src/components/ThemePicker.astro:17`: no `overscroll-behavior: contain`, unlike the team dialog.
- Safe areas: not applicable, as the viewport meta doesn't use `viewport-fit=cover`.

**Theming:** pass. `color-scheme` per theme, `theme-color` set by script, native select has an explicit background.

**Locale:** pass, `Intl` throughout. Nothing uses `translate="no"`, so auto-translate can alter the brand and team names.

**Hydration:** not applicable.

**Hover:**
- `web/src/styles/favourites.css:167`, `web/src/components/ThemePicker.astro:60`, `web/src/components/FavouritePicker.astro:91` and `TabList.astro`: no hover state. Reuse the league chip's rule (`LeagueSwitcher.astro:78`), using existing tokens only.

**Copy:**
- First person: `LeagueUnavailable.astro:21`, `web/src/pages/index.astro:128`, `UpdatedStamp.astro:35`.
- `SiteFooter`: "Built from the data branch at fc66504" means nothing to most visitors.

**Anti-patterns:** none of the 14 found, other than long lists without virtualisation (below).

**Other design notes (not from the checklist):**
- The phone table defaults to "Win the title", which reads `<1%` for 15 of 20 Premier League teams.
- At 360 px the team page's Relegation tile sits alone on its row (`web/src/pages/[league]/[team].astro:349`).

### Ideas flagged and not proposed, because they break a constraint or a decision

| Idea | Source | Why not |
| --- | --- | --- |
| `preconnect` for CDN or asset domains | Pinned rules | No third-party origins exist or are allowed |
| `font-display: swap` | Pinned rules | The site uses `optional` on purpose to protect CLS (`web/src/styles/fonts.css:24`, `:94`) |
| Virtualise long lists | Pinned rules | Adds a library against the bundle budget. `content-visibility` is possible, but would need measuring against sticky columns and anchors |
| New typefaces or a new look | `frontend-design` | Fonts and themes are fixed |
| Remove the all-caps display labels (23 `uppercase` rules) | `frontend-design` | Part of the established design. Worth knowing the skill reads it as a template trait, but not proposed |
| Title Case for headings and buttons | Pinned rules | The site's source text is in sentence case, and `frontend-design` asks for sentence case. The rules conflict, so left as is |
| A bigger animated hero | `frontend-design` | Motion rules are fixed; you already decided against scroll-driven reveals |
| Any colour change | Any | None proposed, so the AA check across 8 themes is not triggered |

## 3. Agreed order of small PRs

Each is independently shippable. Every PR also runs `npm run verify`, the e2e suite locally against fixtures, and `npm run lighthouse`.

| # | PR | Findings | Size | What proves it |
| --- | --- | --- | --- | --- |
| 1 | Home intro and plain track-record line | 1, 3 | S | H1 and lede test; no CLS change; unit tests for each verdict, incl. market missing |
| 2 | Explanations first and a match-card key | 5, 6 | S | Definition above the table at 360 px; 16 px measured; key appears once per list |
| 3 | Calmer warnings, plainer failures, stale warning as real text | 9 | S | One warning when ages match; fixture states show no "contract" text |
| 4 | Phone layout: home prompt after the cards, shorter league page | 2, 4 | M | First percentage above 740 px; shift test passes in all favourite states; first rows on screen at 360 × 740; heading stays without JavaScript |
| 5 | Track record leads with the answer; lighter header and league links | 7, 8 | M | Verdict above the method; all 50 rows still present; header height test at 320 to 1400 px; accessible name kept |
| 6 | Spacing and checklist tidy-up: spacing faults, hover states, tab URL, dialog overscroll, apostrophes, non-breaking spaces. Cut if time runs out | 10, section 2 | S | Chip left edge equals the gutter at 360 px; home rows aligned at 1280 px; hover test in 8 themes; tab click updates the hash |

### Decided not to do

- **`touch-action: manipulation`:** there is no tap delay with the current viewport meta, so it would change nothing.
- **`translate="no"`:** low value, as it adds markup to every brand and team name for a feature the visitor chooses to use.
- **DOM size and list virtualisation:** no measured slowdown to justify the added complexity, and a library would spend bundle budget.
- **Undo for Remove my team:** low stakes, as the status region confirms it and picking the team again takes seconds.
- **Rewording the footer commit line:** it is deliberate provenance, showing which data build the page came from.

## Appendix: screenshots

Screenshots are kept outside the repo.

Saved outside the repo in a temporary folder that may be cleared, so copy any you want to keep. Pages at each width and theme have a `-fold` (first screen) and `-full` (whole page) image. `state-` images come from the fixture build.

- `audit-shots/home-1280-floodlights-fold.png`
- `audit-shots/home-1280-floodlights-full.png`
- `audit-shots/home-1280-matchday-fold.png`
- `audit-shots/home-1280-matchday-full.png`
- `audit-shots/home-360-floodlights-fold.png`
- `audit-shots/home-360-floodlights-full.png`
- `audit-shots/home-360-matchday-fold.png`
- `audit-shots/home-360-matchday-full.png`
- `audit-shots/home-768-floodlights-fold.png`
- `audit-shots/home-768-floodlights-full.png`
- `audit-shots/home-768-matchday-fold.png`
- `audit-shots/home-768-matchday-full.png`
- `audit-shots/league-1280-floodlights-fold.png`
- `audit-shots/league-1280-floodlights-full.png`
- `audit-shots/league-1280-matchday-fold.png`
- `audit-shots/league-1280-matchday-full.png`
- `audit-shots/league-360-floodlights-fold.png`
- `audit-shots/league-360-floodlights-full.png`
- `audit-shots/league-360-matchday-fold.png`
- `audit-shots/league-360-matchday-full.png`
- `audit-shots/league-768-floodlights-fold.png`
- `audit-shots/league-768-floodlights-full.png`
- `audit-shots/league-768-matchday-fold.png`
- `audit-shots/league-768-matchday-full.png`
- `audit-shots/matches-1280-floodlights-fold.png`
- `audit-shots/matches-1280-floodlights-full.png`
- `audit-shots/matches-1280-matchday-fold.png`
- `audit-shots/matches-1280-matchday-full.png`
- `audit-shots/matches-360-floodlights-fold.png`
- `audit-shots/matches-360-floodlights-full.png`
- `audit-shots/matches-360-matchday-fold.png`
- `audit-shots/matches-360-matchday-full.png`
- `audit-shots/matches-768-floodlights-fold.png`
- `audit-shots/matches-768-floodlights-full.png`
- `audit-shots/matches-768-matchday-fold.png`
- `audit-shots/matches-768-matchday-full.png`
- `audit-shots/methodology-1280-floodlights-fold.png`
- `audit-shots/methodology-1280-floodlights-full.png`
- `audit-shots/methodology-1280-matchday-fold.png`
- `audit-shots/methodology-1280-matchday-full.png`
- `audit-shots/methodology-360-floodlights-fold.png`
- `audit-shots/methodology-360-floodlights-full.png`
- `audit-shots/methodology-360-matchday-fold.png`
- `audit-shots/methodology-360-matchday-full.png`
- `audit-shots/methodology-768-floodlights-fold.png`
- `audit-shots/methodology-768-floodlights-full.png`
- `audit-shots/methodology-768-matchday-fold.png`
- `audit-shots/methodology-768-matchday-full.png`
- `audit-shots/state-home-1280-matchday-full.png`
- `audit-shots/state-home-360-floodlights-full.png`
- `audit-shots/state-too-early-league-1280-matchday-full.png`
- `audit-shots/state-too-early-league-360-floodlights-full.png`
- `audit-shots/state-unavailable-league-1280-matchday-full.png`
- `audit-shots/state-unavailable-league-360-floodlights-full.png`
- `audit-shots/state-unsupported-league-1280-matchday-full.png`
- `audit-shots/state-unsupported-league-360-floodlights-full.png`
- `audit-shots/team-1280-floodlights-fold.png`
- `audit-shots/team-1280-floodlights-full.png`
- `audit-shots/team-1280-matchday-fold.png`
- `audit-shots/team-1280-matchday-full.png`
- `audit-shots/team-360-floodlights-fold.png`
- `audit-shots/team-360-floodlights-full.png`
- `audit-shots/team-360-matchday-fold.png`
- `audit-shots/team-360-matchday-full.png`
- `audit-shots/team-768-floodlights-fold.png`
- `audit-shots/team-768-floodlights-full.png`
- `audit-shots/team-768-matchday-fold.png`
- `audit-shots/team-768-matchday-full.png`
- `audit-shots/track-record-1280-floodlights-fold.png`
- `audit-shots/track-record-1280-floodlights-full.png`
- `audit-shots/track-record-1280-matchday-fold.png`
- `audit-shots/track-record-1280-matchday-full.png`
- `audit-shots/track-record-360-floodlights-fold.png`
- `audit-shots/track-record-360-floodlights-full.png`
- `audit-shots/track-record-360-matchday-fold.png`
- `audit-shots/track-record-360-matchday-full.png`
- `audit-shots/track-record-768-floodlights-fold.png`
- `audit-shots/track-record-768-floodlights-full.png`
- `audit-shots/track-record-768-matchday-fold.png`
- `audit-shots/track-record-768-matchday-full.png`
