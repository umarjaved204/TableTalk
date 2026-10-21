# Leagues, rules and data

Where the data comes from, how a league is added, and each league's rules: which were verified against the official tables and which are assumptions.

Contents:

- [The data layer](#the-data-layer)
- [Phase 2: the Bundesliga](#phase-2-the-bundesliga)
- [Phase 2: La Liga](#phase-2-la-liga)
- [Rules that change by season](#rules-that-change-by-season)
- [Phase 2: Serie A](#phase-2-serie-a)
- [Phase 2: Ligue 1](#phase-2-ligue-1)

[Back to the README](../README.md)

## The data layer

**One schema, whatever the source** — `date, competition, season, home_team,
away_team, home_goals, away_goals, neutral, played`. A loader's only job is to
produce that frame; nothing downstream knows where a row came from. Validation is
strict and noisy on purpose (missing values, scores on unplayed fixtures, teams
playing themselves, duplicate fixtures, negative goals) because a quietly mangled
column would show up as plausible but wrong probabilities.

Played results and future fixtures live in the same frame, distinguished by
`played`: the model fits on the played rows, the simulator fills in the rest.

**Results source: [football-data.co.uk](https://www.football-data.co.uk/)** — free,
no API key, one CSV per league-season with a stable layout going back to the 1990s,
updated during the season, and it covers every league in Phase 1 and 2.

**Fixture source: [openfootball/football.json](https://github.com/openfootball/football.json)** —
free, no API key, public-domain data, versioned in git (so a run can be pinned to a
commit and reproduced), one JSON file per league-season with full club names, and
complete dated schedules for all five leagues in scope. The alternative considered
was fixturedownload.com, which also publishes full-season CSVs and is a reasonable
fallback, but it is one site's export with no stated licence or history.
openfootball is community-maintained, so its own scores can lag; TableTalk uses it
for the schedule only.

Currently loaded: Premier League 2010-11 to 2026-27 — 6,130 results plus the
complete 2026-27 schedule (50 played, 330 to come, through 2027-05-30) — and 8,927
Championship results over the same seasons as `context` data (see
[Promoted teams](results.md#promoted-teams)). The long history is there for the backtests
and the promoted-team prior; time decay means the current ratings rest almost
entirely on the last two seasons.

A third source role, **`context`**, carries results from a *related* competition
that the match model may learn from but that is never tabulated, simulated or
checked against the schedule. The Championship feeds the model this way without a
single Championship row reaching the Premier League's tables.

**Team-name normalisation** — sources spell clubs differently ("Man United",
"Manchester Utd", "Manchester United FC"). Unreconciled, that silently splits one
club into several weaker teams. Names are resolved through
`configs/team_aliases.yaml` in two steps: a fingerprint (lower-case, accents and
punctuation stripped, club suffixes like "FC"/"AFC" dropped) that handles most
variation for free, then explicit aliases for the rest ("Spurs" is not a
fingerprint of "Tottenham Hotspur"). There is deliberately **no fuzzy fallback** —
an unknown name raises, listing close matches, so the fix is one line in the alias
file. `python -m tabletalk data check` reports all unknown names at once.

**Remaining fixtures come from the published fixture list.** Data sources carry a
role: `results` (authoritative for scores) or `fixtures` (authoritative for the
schedule). The two are reconciled on `(season, home team, away team)` rather than on
the date, because dates move — postponements, TV rescheduling — while the pairing
does not. Played matches keep the results source's score and gain the fixture list's
matchday; the fixture entries that have not happened yet become the remaining
fixtures, with real dates.

Mismatches are reported, not patched over: a played result with no entry in the
fixture list almost always means a team name that failed to normalise in one source,
which would otherwise appear as a phantom extra team. `check_fixture_list`
separately verifies the loaded schedule against the config — team count, matches per
team, home/away balance, every pairing present the right number of times — so a
schedule missing a match cannot quietly produce confident wrong numbers.

### Adding a league: the checklist

The five leagues were added this way; no model or simulator code is specific to
any of them.

1. **Rules, from the league's own regulations**, not from memory: team count,
   points, the tiebreaker chain (in order), relegation and play-off places, and
   whether any place is settled by a play-off match. Record each with its source
   and the date checked in the config's `verification` block, and list what
   could not be confirmed as an assumption.
2. **Check whether the rules changed** over the seasons you load. Put the rules at
   the start of the data at the top of the config and every later change under
   `rule_changes` (`from_season` for a lasting change, `seasons` for a one-off
   such as a season stopped early), each with a reason and a source.
3. **Copy a config** (`configs/competitions/bundesliga.yaml` is a compact one) and
   set the data sources: football-data.co.uk `division` for results (with
   `odds_preference` for the market benchmark), openfootball `league_code` for the
   fixture list, the second tier as a `role: context` source.
4. **Team names:** run `python -m tabletalk data check -c <league>` and add every
   name it reports to `configs/team_aliases.yaml` (exact matching; watch for two
   clubs from one town).
5. **Official tables:** run `python scripts/fetch_official_tables.py <league>
   "{season} <Wikipedia title>"` and resolve every season that differs: a missing
   points deduction (`configs/points_deductions.yaml`), a result awarded off the
   pitch (`configs/awarded_results.yaml`), a play-off (`configs/playoff_results.yaml`),
   a rule you got wrong, or (rarely) an error on Wikipedia, recorded with evidence
   in the script's `CORRECTIONS`. Only when every season matches is the league
   done.
6. **COVID seasons and the split:** list excluded seasons with reasons under
   `evaluation.exclude_seasons` and reuse the tune/report split.
7. **Tests:** a test file for the league's distinctive tiebreakers (build a table
   where they decide and another league's chain would not).
8. **Backtest:** `evaluate`, `evaluate-seasons` and `benchmark` with `--split
   report`, and write up the results and limitations.

If any step needs a change to the model or the simulator, stop: it is a design
problem, not a league detail.

**Verify the rules; do not assume they match England.** Tiebreaker order in
particular differs by league (La Liga and Serie A use head-to-head results
*before* goal difference; the Premier League does the opposite), as do relegation
play-offs and European places. Each config carries a `verification` block naming
what was checked, when, and what remains an assumption.

### Premier League rules: verified and assumed

Checked 2026-09-26: 20 teams, 38 matches each, 3/1/0 points; tiebreakers goal
difference → goals scored → head-to-head points → head-to-head away goals
(Handbook Rule C.17); bottom three relegated with no play-off.

Reported zones are stated as **league positions** — title, top four, top five, top
half, relegation — not as "qualifies for the Champions League". Which European place
a position earns depends on UEFA coefficients (England currently has a fifth
Champions League entry through the European Performance Spot) and on domestic cup
winners; neither is modelled while the scope is domestic leagues, so quoting a
qualification probability would overstate what the model knows.

Flagged assumptions, recorded in the config file itself:

- **A1** The real last tiebreaker is a play-off at a neutral ground; we use a coin
  flip. The chance of reaching it is negligible.
- **A2** Zones are league positions only, for the reason above.

### Points deductions

A table is normally the sum of results, but a league can also take points away (or
give them back on appeal). Those decisions live in a data file,
[configs/points_deductions.yaml](../configs/points_deductions.yaml): one entry per
official decision, with the season, competition, team, points, the date it took
effect and a link to the official statement. No deduction appears in Python.

- **Only the overall total changes.** Head-to-head tiebreakers count points won
  in the matches between the tied teams, which a deduction does not touch (a test
  checks exactly that).
- **Dates matter.** A replay from a date (`--as-of`, and every season-backtest
  checkpoint) applies only decisions dated before it, like results. An appeal is
  its own dated entry, so Everton's 10 points (17 November 2023) become 6 on 26
  February 2024, then 8 with the second deduction (8 April 2024).
- **A typo fails loudly**: a deduction naming a team not in that season raises an
  error instead of being ignored.

The Premier League has had deductions in one loaded season, 2023-24: Everton −8
and Nottingham Forest −4. With them, the rebuilt 2023-24 table matches the
official final table in every row and column (a test checks all 20 rows);
without them, Everton would be 12th instead of 15th. Earlier Premier League
deductions (Middlesbrough 1996-97, Portsmouth 2009-10) predate the data.
Leicester City's six points in 2025-26 were in the Championship, which is model
input only and never tabulated.

It mattered to the backtest: at the 75% checkpoint of 2023-24 (30 March 2024), the
real table had Forest 18th on 21 points. The table built without deductions had
them on 25 and safe, so the "table as it stands" baseline was quietly using a
table nobody saw at the time.

## Phase 2: the Bundesliga

The first league added after the Premier League, and the test of the
architecture: it was added with **a config file, team aliases and tests, and no
change to the model or simulator code**. Its differences from England (18
clubs, a relegation play-off place, a different tiebreaker chain) are all config.
The only Python changes were in the command-line output (a generic "second tier"
label, and an explanation where a baseline was perfect, below).

### Rules: verified and assumed

From the DFL's own rulebook, the Spielordnung (SpOL), editions of 22 August 2019
and 6 March 2026, which are identical on these points. Everything is recorded in
[configs/competitions/bundesliga.yaml](../configs/competitions/bundesliga.yaml) with
its source.

| rule | Bundesliga | source |
|---|---|---|
| clubs, matches | 18, 34 each | the data (every season 2010-11 to 2026-27); see note |
| points | 3 / 1 / 0 | SpOL § 2 Nr. 3 a) |
| tiebreakers | goal difference, goals scored, **aggregate score of the two meetings**, away goals in those meetings, **all away goals**, then a play-off on a neutral ground | SpOL § 2 Nr. 3 c) |
| relegation | 17th and 18th | SpOL § 3 Nr. 2 |
| relegation play-off | 16th v the 2. Bundesliga's 3rd, two legs | SpOL § 3 Nr. 2; held every season since 2008-09 |
| points deductions | none in any loaded season | last ones 1993-94, 1999-2000, 2003-04; a negative-equity deduction exists since 2024-25 but has not been applied |

The tiebreaker chain is where the leagues genuinely differ. England uses
head-to-head *points*; Germany uses the head-to-head *aggregate score* (a 3-0 win
and a 0-1 defeat beats a 1-0 win and a 0-3 defeat), then away goals, including
away goals over the whole season. Tests build tables where each Bundesliga
criterion decides and the Premier League chain would decide differently.

Flagged:

- **Not confirmed by a rule text:** "18 clubs" (the SpOL only fixes 32 to 36 clubs
  across both divisions), and the tiebreaker text before 2019-20 (no older edition
  found; the same order is assumed). Every final table 2010-11 to 2025-26 matches
  the official one, which confirms goal difference and goals scored; no real tie
  in those seasons went further, so the head-to-head criteria are untested by
  history (they are tested on hand-built tables).
- **Assumption:** the final criterion, a one-off play-off on a neutral ground, is
  approximated by a coin flip, as in England. A proposal to simulate it properly is
  below, pending approval.
- **Assumption:** for three or more clubs level on points, goal difference and
  goals, the head-to-head criteria use the mini-table of all their meetings (the
  rule is written for two clubs).
- **Assumption:** during a season the DFL applies head-to-head criteria only once
  both meetings have been played; TableTalk's *mid-season* table always applies
  the full chain. Simulated final tables are unaffected.

The relegation play-off is reported as its own zone, "finishes 16th"; the play-off
against the second-tier side is not simulated.

### Data

football-data.co.uk `D1` (results, odds) and `D2` (2. Bundesliga, model input
only), openfootball `de.1` (the 2026-27 fixture list). 5,202 Bundesliga matches,
2010-11 to 2026-27. 52 German club names were added to the alias file; `data
check` flagged every unmapped one, including a club missed on the first pass.
Accents need no alias (the matching key strips them), but "ß" and numbered prefixes
("1. FC Köln", "TSG 1899 Hoffenheim") do. Clubs promoted through the play-off
count as promoted: they are simply the clubs not in last season's Bundesliga
(Paderborn 2026-27, tested).

The COVID seasons 2019-20 (resumed behind closed doors on 16 May 2020) and 2020-21
(almost entirely without crowds) are excluded from results, as in England; 2019-20
had the lowest home-win rate of any loaded season (40.2%). The tune/report split
is the same seasons as the Premier League's.

### Results

Premier League settings throughout (365-day half-life, ridge sd 1, `prior`,
rating uncertainty): none were re-tuned for the Bundesliga. Report seasons
(2018-19, 2021-22 to 2025-26, 1,836 matches):

| | log loss | vs base rates | vs market |
|---|---|---|---|
| base rates | 1.070 | | |
| model | 0.990 | −7.5% | market better by 0.019 ± 0.008 |
| market (closing odds) | 0.971 | | |

- **Market.** The model closes **81% of the gap** between knowing nothing and the
  market (England: 83%), between 73% and 95% per season. Pinnacle priced every
  report-season match but one until January 2026; the rest of 2025-26 uses the
  market average.
- **Calibration.** Average gap from the diagonal 3.2 / 1.2 / 2.4 points (home /
  draw / away); market 2.2 / 1.7 / 1.3.
- **Home advantage** is larger than in England: +0.22 (home sides score ×1.24)
  against +0.17.
- **Season level.** Ahead of "knows nothing" in every cell, and ahead of "the table
  as it stands" in all but one: relegation at 50% played, where the table as it
  stood was exactly right in all six seasons. The command now says so instead of
  printing `NaN`. The model's title favourite won 5 of 6 titles from the first three
  checkpoints and 6 of 6 from 75% played; the miss was Bayern, favoured until
  midway through 2023-24, when Leverkusen won the league. Pooled calibration gap
  1.2 points.
- **The relegation play-off place is hard to call.** Skill against "knows nothing"
  is small (1% pre-season, 22% at 75% played): one exact position is a narrow
  target, and 14th to 18th are often close.

**Promoted teams: no detectable difference between `prior` and `second_tier` in
Germany.** On promoted-team matches, `prior` minus `second_tier` is +0.0098 ±
0.0101 on the tuning seasons and −0.0004 ± 0.0110 on the report seasons; `prior`
minus `none` is +0.0002 ± 0.0179 and −0.0173 ± 0.0120. Applied to the
Bundesliga's own tuning seasons, the Premier League's selection rule would have
chosen `second_tier`, but by a margin inside the noise. `prior` is kept as the
cross-league default; choosing per league would need a rule stated before
running. The prior is also thinner here: usually only two clubs are promoted (the
Bundesliga club usually wins the play-off), so it rests on 2 teams for 2012-13,
5 to 13 over the tuning seasons and 15 to 30 over the report seasons (England: 3
to 45).

### Every final table, every season

Rebuilding one official table proves little; `tests/test_official_tables.py`
rebuilds **every** completed season's final table, finishing order and points, and
compares it with the official one (fetched from Wikipedia's structured season
tables by `scripts/fetch_official_tables.py`; secondary source, checked against
official sources where they disagree). It checks the results data, team names,
each league's tiebreakers and the points-deductions file at once:

| league | seasons | identical |
|---|---|---|
| Premier League | 2010-11 to 2025-26 | 16 of 16 (incl. Everton and Forest 2023-24) |
| Bundesliga | 2010-11 to 2025-26 | 16 of 16 |
| La Liga | 2010-11 to 2025-26 | 16 of 16 |
| Serie A | 2010-11 to 2025-26 | 16 of 16 |
| Ligue 1 | 2010-11 to 2025-26 | 16 of 16 |

Getting there found 16 deductions that were missing (Almería in La Liga 2014-15,
eleven in Serie A, four in Ligue 1), three results awarded off the pitch, one
play-off, a tiebreak detail of Ligue 1's shortened 2019-20, and three errors in
Wikipedia's own tables (corrected in the fetch script, with evidence). Each is
recorded as data with its source.

### The play-off at the end of the chain

The last Bundesliga tiebreaker, like England's, is a one-off match on a neutral
ground. Both configs now end with `playoff_match`: when a simulated season reaches
it, the simulator plays the match with the match model and no home advantage, a
draw settled 50/50 for extra time and penalties. A displayed table lists such
clubs alphabetically. Two clubs level on all earlier criteria is vanishingly rare.

### Known limitations (Bundesliga)

- The Premier League's settings are used unchanged; the Bundesliga's own tuning
  seasons might prefer a different half-life or promoted-team strategy.
- The promoted-team prior rests on few clubs early in the backtest.
- The relegation play-off is a zone ("finishes 16th"), not a simulated tie.
- Ratings are fitted per league and **must not be compared across leagues**: a
  Bundesliga attack rating of +0.3 and a Premier League one of +0.3 are each
  relative to their own league's average, and nothing puts the two leagues on one
  scale. Cross-league comparison is a Phase 3 problem.

## Phase 2: La Liga

Added by config, team aliases and tests only; no Python change at all.

### Rules

From the RFEF's *Bases de Competición* for Primera and Segunda División (editions
for 2019-20, 2020-21 and 2025-26), recorded with sources in
[configs/competitions/la_liga.yaml](../configs/competitions/la_liga.yaml): 20 clubs,
38 matchdays, 3/1/0, 18th to 20th relegated, no relegation play-off.

**Head-to-head comes first in Spain**, before overall goal difference:

| clubs level | criteria, in order |
|---|---|
| two | goal difference in their two meetings, overall goal difference, goals scored, fair play, play-off on a neutral ground |
| three or more | points in a mini-league of their meetings, goal difference in it, overall goal difference, goals scored, fair play, play-off |

One configured chain covers both (for two clubs, "head-to-head points, then
head-to-head goal difference" always orders them the same way as head-to-head goal
difference alone), with head-to-head re-applied to any smaller group left level.
Flagged:

- **Fair play is not modelled** (it needs card and sanction data); it and the
  neutral-ground play-off become the coin flip.
- **Three-way ties.** The 2025-26 text can be read as going back to the pair
  straight after mini-league points, where the engine applies the whole
  head-to-head block to the group first. La Liga had 14 three-way ties on points in
  these 16 seasons and the two readings never gave a different order; every
  final table matches the official one.
- **Positions, not outcomes.** In 2014-15 Elche finished 13th and were relegated
  for unpaid debts, and Eibar, in the drop zone, stayed up. Zones are finishing
  positions, so "relegation" means "finishes 18th to 20th".

Data: football-data.co.uk `SP1` and `SP2` (Segunda, model input only), openfootball
`es.1`. 76 Spanish club names were added, including reserve sides ("Barcelona B"
is a different club) and one club football-data spells two ways ("Cultural
Leonesa" and "Leonesa"). COVID seasons excluded as elsewhere; same tune/report
split.

### Results

Premier League settings, not re-tuned. Report seasons, 2,280 matches:

- **7.6% better than base rates** in log loss (0.988 against 1.069); the model
  closes **83% of the gap to the market** (0.971), between 77% and 94% per season.
- **Calibration** 3.0 / 2.1 / 3.0 points (home / draw / away); market 2.7 / 1.4 /
  2.3.
- **Season level:** ahead of both baselines everywhere except the title at 75%
  played, where the table as it stood was right in all six seasons (Brier 0.0018
  for the model: it did worse only by hedging). The pre-season favourite won only
  2 of 6 titles, the least predictable of the three leagues so far. Pooled
  calibration gap 1.0 points.
- **Promoted teams:** no detectable difference between the three strategies
  (`prior` minus `second_tier` on promoted-team matches: +0.0017 ± 0.0071 tuning,
  −0.0025 ± 0.0060 report; minus `none`: −0.0066 ± 0.0101 and −0.0063 ± 0.0070).
  Three clubs are promoted every season, so the prior rests on 3 to 45 teams, as
  in England.

## Rules that change by season

Serie A and Ligue 1 could not be added with rules fixed for all time: Ligue 1
went from 20 clubs to 18 and changed its relegation places five times, and both
changed their tiebreakers. That was the one design problem Phase 2 found (the
config assumed a league's rules never change), and the fix is general:

- **`rule_changes`**: a config states the rules at the start of its data and then
  each change, with its season, reason and source. Everything that works on one
  season (tables, the simulator, the season backtest, the data checks) asks for
  that season's rules (`config.for_season`), so a backtest of 2016-17 uses 2016-17's
  team count, zones and tiebreakers. Every rule version is validated when the
  config loads.
- **New rule types**, each general and tested: `away_wins` (a tiebreaker);
  `ranking: points_per_match` and `completed_early` (Ligue 1 2019-20, stopped by
  COVID); `head_to_head_needs_all_meetings` (France uses head-to-head criteria only
  once both meetings are played); and `position_playoffs`, a match for one
  particular place (Serie A's title and 17th v 18th), simulated as one match at a
  neutral ground, one at the higher-ranked club's ground, or two legs on aggregate.
- **More results as data**, found by the official-table check: results awarded off
  the pitch (`configs/awarded_results.yaml`; the table uses the awarded result, the
  match model the real one, including France's rule that a forfeit counts the win
  but not the goals), and play-offs that were actually played
  (`configs/playoff_results.yaml`).

## Phase 2: Serie A

**Rules:** the FIGC sets Serie A's tie rules each season by a ruling that departs
from its general rules (art. 51 NOIF); the rulings for 2019-20, 2023-24, 2024-25,
2025-26 and 2026-27 were read. Ties go to the *classifica avulsa* (points, then
goal difference, in the matches among the clubs level; then overall goal
difference, goals, and a drawing of lots). From 2022-23 a tie on points **for the
title or for 17th v 18th** is settled by a play-off instead: in 2022-23 one match
at a neutral ground (the only one played so far: Verona 3-1 Spezia); from 2023-24
one match at the higher-ranked club's ground for the title, and two legs on
aggregate for 17th v 18th. Flagged: the 2022-23 ruling and those before 2019-20
were not found (the formats are taken from the play-off played and the 2019-20
ruling), play-offs use best-estimate ratings, and from 2026-27 no play-off is held
if a club is in a European final, which is not modelled.

**Found by the official-table check:** eleven deductions (Bologna 2010-11;
Atalanta 2011-12; Siena, Atalanta, Sampdoria and Torino in 2012-13, after the
betting scandal; Parma 2014-15; Chievo 2018-19; Juventus 2022-23, recorded as it
happened: −15, restored, then −10), Verona v Roma 2020-21 (played 0-0, awarded 3-0),
and two errors in Wikipedia's tables (a Lazio deduction in 2017-18 and 2018-19
that never happened, and the 2022-23 order before the play-off). One date is not
found (part of Bologna's 2010-11 deduction) and Parma's split between February and
March 2015 is uncertain; neither season is in the report seasons.

**Results** (report seasons, 2,280 matches, Premier League settings): 9.6% better
than base rates; the model closes **85% of the gap to the market**. Season level:
ahead of "knows nothing" everywhere, ahead of "the table as it stands" everywhere
except the title at 50% played (−45%); the pre-season favourite won 2 of 6.
Promoted teams: no detectable difference between the strategies.

## Phase 2: Ligue 1

**Rules** (LFP, as reported by ligue1.com and Orange; the regulations before 2025
were not found): overall goal difference first, then head-to-head (only once both
meetings are played), then goals; until 2024-25 head-to-head goals and away goals
and overall away goals, from 2025-26 wins and away wins (away goals dropped). The
fair-play and fewest-cards criteria are not modelled (coin flip). Format by season:

| seasons | clubs | relegated | relegation play-off |
|---|---|---|---|
| 2010-11 to 2015-16 | 20 | 18th-20th | none |
| 2016-17 to 2021-22 | 20 | 19th-20th | 18th (none in 2019-20) |
| 2022-23 | 20 | 17th-20th | none (league shrinking to 18) |
| 2023-24 on | 18 | 17th-18th | 16th |

2019-20 was stopped on 30 April 2020 after 28 matchdays and ranked on points per
match; clubs level on that were separated on head-to-head where both meetings had
been played (Nice above Reims) and on goal difference otherwise (Lyon above
Montpellier). That reading reproduces the official table exactly; the LFP's text
was not found.

**Found by the official-table check:** four deductions (AC Ajaccio 2012-13; Nice
and Lyon 2021-22, both after crowd trouble; Montpellier 2023-24) and two forfeits
counted as a win without goals (Nantes v Bastia 2013-14, Bastia v Lyon 2016-17).

**Results** (report seasons, 2,058 matches): 6.4% better than base rates, the
smallest margin of the five, and **77% of the gap to the market**, the lowest
(2018-19 only 51%). PSG's dominance makes the title easy (the favourite won all
six from every checkpoint); the relegation play-off place is barely predictable at
all (skill against "knows nothing" between −2% and 8%).
