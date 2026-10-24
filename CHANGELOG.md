# Changelog

What changed and why, newest first. How things work today is in the
[README](README.md) and [docs/](docs/); the detail of each change is in its
commit and pull request.

## 24 Oct 2026

- **Website animations**: pages crossfade between pages of the site (Chrome,
  Edge and Safari; Firefox changes page at once, as before), a theme chosen
  in Appearance fades in, a saved team's stars pop once, hovering a league's
  name on a home card lifts the card, a pressed button shrinks slightly, and
  a faint pitch draws beside the home heading in 0.6 s. Only transform and
  opacity are animated, each effect plays once, the page without animation
  is the finished page, and everything is off with reduced motion.
  `tests/e2e/animations.spec.ts` checks these rules on every page, in
  Chromium and WebKit. Decided against: the team name moving from the table
  into the team page heading (the browser animates its size as well, and it
  needs a stylesheet with one name per team) and scroll-driven chart reveals
  (the bars keep growing in once on load).
- **Track record notes in plain English**: the note about matches needed no
  longer uses the field name `matches_needed`, and the contract says the
  notes are shown to visitors as written. It also says a match that has
  kicked off can still be listed as upcoming, with a prediction that is never
  the one locked. Wording only; `pipeline_hash` changes once (the note's
  text is pipeline code), no published number changes.
- **Decision: no earlier nightly try.** The tries stay at 01:37-07:37 UTC.
  The first-seen log can't measure how fast the results source is (its
  delays were bounded by our own run times), and a 16 Oct result wasn't
  available until about 08:00 UTC, so an earlier try would mostly find
  results missing. Revisit only if a lock is ever made without the previous
  day's results.
- **Not planned: confirmed kick-off times** (contract request R9).
  football-data.org can't tell a confirmed kick-off time from a default slot
  that TV picks may still move: both are `TIMED`, with the same fields.

## 23 Oct 2026

- **Simpler, before the announcement** (a review of what each part costs and
  what it protects):
  - Personal links (`?team=`) and their QR codes removed, so no shared link
    depends on them. An old `?team=` link is ignored.
  - The nightly run loads only what it uses: no openfootball cross-check (a
    failed download would fail a league; football-data.org and
    football-data.co.uk must still agree) and no second-tier results (only
    the unused `second_tier` strategy reads them). Each snapshot's `sources`
    now lists only what the run loaded.
  - The rating-drift option removed (off since 27 Sep; it added nothing).
  - The first-seen results log frozen: its delays were bounded by our own run
    times (9 to 18 hours), so it couldn't measure how fast the source is.
  - `requirements.txt` removed (a duplicate of `pyproject.toml`).
  - `pipeline_hash` and every league's `config_hash` changed once, with no
    published number changing: the update run offline on the old and new code
    (same data, same time, all five leagues) gave identical tables, chances
    and all 1,405 pending predictions.
  - The browser tests' DOM budgets removed (measured on test data, exceeded on
    the live site); the monthly live Lighthouse check records page sizes
    instead. The axe matrix runs every page in Matchday, Floodlights and High
    Contrast at three widths (195 runs, was 265 with High Contrast on three
    pages only).
  - Docs merged into a [runbook](docs/runbook.md) and this changelog; the
    website's contract requests moved to GitHub issues labelled `contract`.
    The site reads the current schemas from `contracts/` itself.
- Pages compressed: `no-transform` in `Cache-Control` had stopped Cloudflare
  compressing them (the Premier League page was 232 KB and its largest paint
  2.7 s on a slow phone; now about 26 KB and 1.5 s).
- The go-live check after a deploy is tried up to 4 times, 30 s apart: a
  headers-only deploy was checked 2 seconds after deploying, before every
  Cloudflare location had it.
- Code words in the pipeline's notes wrap: `matches_needed` at 200% text made
  the track record wider than an iPhone SE.
- Share images: fixed, with no numbers, one for the site and one per league.
- A ruleset protects `main` against deletion and force pushes; secret
  scanning, push protection and Dependabot alerts switched on.
- Wrangler 4.149.0, which brings `sharp` 0.35.5 (security alert; never
  reachable, since deploying doesn't decode images).

## 22 Oct 2026

- **Live at https://tabletalk.fyi**, on Cloudflare Workers static assets,
  in three stages: workers.dev, then the domain, then workers.dev switched
  off. Cloudflare's Network Error Logging headers (a request to another
  server after a failed load) are switched off in the zone, since `_headers`
  can't remove them.
- The deploy job runs the go-live check against the live site and fails if it
  doesn't pass. A reusable workflow only sees the secrets its caller passes:
  the first deploy skipped with an empty token and a green run, now tested.
- `pipeline_hash` proven: the first nightly run after the website merge had a
  new `code_commit` and the same `pipeline_hash`.

## 21 Oct 2026

- The website merged into `main`; the README split into `docs/`.

## 20 Oct 2026

- **Known results.** football-data.org listed finished matches as TIMED again
  (16, 17 and 20 Oct): the public scored count went backwards (47 to 44 for
  about 26 hours; 95 to 82 on 20 Oct) and the table lost results. Every final
  score is now remembered and put back while no source gives it.
- **Hardening:** exact library versions with hashes; the job with the API key
  can no longer push, and the publish job checks the commit's shape first;
  actions pinned to commit SHAs; the raw-download cache checked against a
  record; Dependabot.
- **Contract 1.2.0:** `pipeline_hash`, `results_complete` and
  `missing_results`, `contract_version` on new lock-log lines, and readers
  must ignore unknown fields.

## 13 Oct 2026

- The nightly trial passed (9 to 13 Oct: 50 runs, 48 locks, 1 void, nothing
  invalid or missed). Changes from it: a day is **done** only when every
  league updated and no finished match is missing its result (on 12 Oct
  Sunday's results weren't in at 07:57, so the day's predictions lacked
  them and the later tries skipped); called-off matches listed; a warning
  when the first update is close to the first kick-off.

## 2 Oct 2026

- Four tries a night (01:37, 03:37, 05:37, 07:37 UTC). The first runs had
  started 6 to 7 hours late, after the earliest kick-offs.

## 29 Sep to 6 Oct 2026: the website

- Astro, static, built only from the published files; eight themes, WCAG 2.2
  AA tests, no trackers or cookies (29 Sep to 2 Oct).
- Favourite team, shown from the first paint without layout shift (4 Oct).
- Team pages, title races at a glance on the home page, a lighter league
  page (6 Oct).

## 28 to 29 Sep 2026: the nightly pipeline

- football-data.org as the fixture source (and a second results source);
  openfootball became a cross-check.
- `python -m tabletalk update`, dated snapshots and the data contract (1.0.0),
  then locking before kick-off and the live track record (1.1.0).
- The nightly GitHub Actions run, publishing to the protected `data` branch.
  The branch is protected against deletion and force pushes. **Live since
  29 Sep 2026, 16:31 UTC.**

## 26 to 28 Sep 2026: the model and the five leagues

- **Premier League** (26 Sep): data, the Dixon-Coles match model, the season
  simulator, match and season backtests. The COVID seasons are left out of
  the headline results.
- **27 Sep:** rating uncertainty fixed early-season over-confidence (drift was
  tried too and added nothing); a clean tuning/reporting split (half-life 180
  to 365 days); the betting-market benchmark; points deductions as dated data
  (reproducing 2023-24 exactly flipped one headline result from −43.5% to
  +22.5%); the wording rule for differences. The **Bundesliga** added with a
  config, aliases and tests, and no model or simulator change.
- **28 Sep: La Liga, Serie A and Ligue 1.** Rules that change by season, new
  tiebreaker and play-off rule types, awarded results and play-offs as data,
  and the last tiebreaker played as a match instead of a coin flip. Every
  official final table 2010-11 to 2025-26 reproduced (80 of 80).
