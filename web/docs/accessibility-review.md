# Accessibility review

What has been checked, how, and what still needs a person. Target: WCAG 2.2
level AA.

## Automated (run with every `npm run test:e2e`)

| Check             | What it covers                                                                                                                                                                                                                                                                                                                                                                          | Where                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **axe matrix A**  | 3 representative pages (a league page, a matches page, the track record) × all 7 colour themes × 5 widths (360, 390, 768, 1024, 1440 px) = 105 runs. The 8th choice, System, is not a theme of its own: it shows Matchday, Floodlights or High Contrast, all covered.                                                                                                                   | `tests/e2e/a11y-matrix.spec.ts` |
| **axe matrix B**  | Every other page (12) × Matchday and Floodlights × 5 widths = 120 runs                                                                                                                                                                                                                                                                                                                  | same                            |
| **Keyboard walk** | Every page (15) at 1440 and 390 px: Tab from the top until focus comes back round. The skip link is first and moves focus to the content; every stop is visible, on screen and has a focus ring; every control is reached; no tabindex above 0; no keyboard trap. The Appearance dialog on every page: opens with Enter, focus moves in, Escape closes it, focus returns to the button. | `tests/e2e/keyboard.spec.ts`    |
| **Phones**        | 7 phone profiles (WebKit and Chromium): no sideways scroll, tap targets ≥ 24 px (main controls 44 px), no text under 12 px, 200% text, wider text spacing                                                                                                                                                                                                                               | `tests/e2e/mobile.spec.ts`      |
| **No JavaScript** | Every section and number still shown; no controls that can't work                                                                                                                                                                                                                                                                                                                       | `tests/e2e/no-js.spec.ts`       |
| **Contrast**      | Every theme's token pairs, recomputed from the CSS (text 4.5:1, controls and data marks 3:1)                                                                                                                                                                                                                                                                                            | `tests/unit/themes.test.ts`     |

Each axe run also fails on sideways scroll and on any console error, which
includes a Content Security Policy violation. Every "Show the numbers" table
is opened before axe runs.

**What these can't tell:** whether the reading order makes sense, whether
names are clear out of context, and whether announcements are useful. That
needs the two passes below.

## Manual pass 1: keyboard only (to do)

Use a desktop browser without touching the mouse. For each page below, start
at the address bar and press Tab.

| Step                           | Expected                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| First Tab                      | "Skip to content" appears top left; Enter jumps past the header                                  |
| Tab through the header         | TableTalk, Track record, Methodology, Appearance; the focus ring is always visible               |
| Appearance → Enter             | Dialog opens; arrows change the theme at once; Escape closes it and focus is back on Appearance  |
| League page, below 900 px wide | Tabs: Table / Next matches / Positions. Arrow keys move between them; Tab moves into the section |
| League table                   | Short / Full with arrow keys; in Short, the "Chance shown" list changes the column               |
| Table and heatmap boxes        | Focusable (they scroll sideways); arrow keys scroll them                                         |
| Race charts                    | "Show the numbers" opens with Enter or Space                                                     |
| Matches page                   | Upcoming / Recent tabs below 900 px; each card is read in order                                  |
| Every page                     | Nothing is reachable that you can't see; the order follows the page                              |

Pages: `/`, `/premier-league/`, `/premier-league/matches/`, `/bundesliga/`,
`/track-record/`, `/methodology/`, `/about/`, `/404/`.

## Manual pass 2: NVDA screen reader (to do)

NVDA (free, nvaccess.org) with Firefox or Chrome on Windows. Useful keys:
H / Shift+H (next / previous heading), D (next landmark), T (next table),
Ctrl+Alt+arrows (move by table cell), Insert+F7 (list of headings and links),
Tab (next control).

| Where                                      | Expected                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any page, Insert+F7 headings               | One heading level 1 per page; sections as level 2; no skipped levels that make the outline confusing                                                                                                         |
| D (landmarks)                              | Banner (header), navigation (site, leagues, league pages), main, content info (footer)                                                                                                                       |
| Header link "Track record" on its own page | Announced as current page                                                                                                                                                                                    |
| Appearance                                 | "Appearance, button, has popup dialog"; in the dialog, each theme as a radio button with its description; "1 of 8"                                                                                           |
| League table (T)                           | Caption read as "Premier League table, with each team's chances from 10,000 simulated seasons"; moving across a row reads the column header with each cell; zone rows say the zone (e.g. ", Title")          |
| Short / Full                               | Radio buttons in a group "Table view"                                                                                                                                                                        |
| Phone tabs (narrow window)                 | "Table, tab, selected, 1 of 3"; the section is announced as a tab panel                                                                                                                                      |
| Match card                                 | Card named "Arsenal v Leeds United"; outcomes read as "Arsenal win 66%", "Draw 22%", "Leeds United win 12%" (not "Home"/"Away"); a played match reads "Final score 2–1" and "(what happened)" on the outcome |
| Times                                      | Read in your time zone, e.g. "12:30"; the note says "Times in your time zone (BST)"                                                                                                                          |
| Race chart and calibration chart           | The pictures are skipped; the "Show the numbers" table and the calibration table are read instead                                                                                                            |
| Stale data (only when it happens)          | The "Last updated … ago" warning is read as part of the update line                                                                                                                                          |

## Results

| Date       | Tester    | Setup                                             | Pass                       | Issues found |
| ---------- | --------- | ------------------------------------------------- | -------------------------- | ------------ |
| 2 Oct 2026 | automated | Playwright 1.63, axe-core 4.13, Chromium + WebKit | All automated checks above | None open    |
|            |           |                                                   | Manual keyboard            |              |
|            |           | NVDA … with …                                     | Manual screen reader       |              |

Write each issue with the page, what happened, what was expected, and how
serious it is (blocks a task / confusing / cosmetic).
