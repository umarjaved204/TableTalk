# How it works

Probabilistic football forecasting: a Dixon-Coles match model feeding configurable
competition simulators, producing the kind of numbers newspapers print as
"supercomputer predicts the title race" — but with the method written down, the
assumptions flagged, and the forecasts checked against what actually happened.

Why the project is built in three layers, how the match model turns two teams into scoreline probabilities, how the season simulator plays the rest of a season 10,000 times, and where the data and each league's rules come from.

Contents:

- [Why this architecture](#why-this-architecture)
- [The league simulator](#the-league-simulator)
- [Leagues, rules and data](#leagues-rules-and-data)
- [Reference](#reference)

[Back to the README](../README.md)

## Why this architecture

Every competition is a different game — 20 teams playing 38 matches, 18 teams with
a relegation play-off, 36 teams playing 8 different opponents and then a knockout
bracket. The temptation is to write "the Premier League model" and then copy-paste
it. Instead there are three layers that know as little about each other as possible:

| Layer | Question it answers | Knows nothing about |
|---|---|---|
| **Match model** (`tabletalk.model`) | Given these two teams and this venue, how likely is every scoreline? | Tables, brackets, points |
| **Competition simulators** (`tabletalk.simulation`) | Given a format and a match model, what happens if the season is played 10,000 times? | How match probabilities are produced |
| **Competition configs** (`configs/competitions/*.yaml`) | What are this competition's rules? | Python |

The test of the design is Phase 2: adding La Liga should be a new config file, not
a new code path. If it is not, the design is wrong and gets fixed rather than
worked around.

**No competition facts in code.** "20 teams", "38 matches", "top four qualify",
"goal difference before head-to-head" all live in the config. The Python only
knows *kinds* of rules: it can apply a list of tiebreakers drawn from a fixed
vocabulary, and report the probability of finishing inside an arbitrary set of
positions. Config values are validated at load time
([src/tabletalk/config.py](../src/tabletalk/config.py)), so a typo is a clear error
rather than plausible-looking wrong output.

### Why Dixon-Coles rather than Elo or gradient boosting

- **Elo** rates team strength on one axis and predicts match outcomes, but it does
  not produce *scorelines*. Simulating a league needs goals, because goal
  difference decides positions, so a goal-level model is the natural fit.
- **Gradient boosting** on match features can be very good at predicting
  home/draw/away, but with a few thousand rows and no injury/lineup/xG feed it
  mostly rediscovers "who is better", while being far harder to explain and far
  easier to overfit.
- **Dixon-Coles** is a small, interpretable generative model: every team has an
  attack and a defence parameter, plus one league-wide home-advantage term. That
  gives a full distribution over scorelines, which is exactly what a simulator
  consumes, and every parameter means something you can say out loud
  ("Arsenal's attack is 1.4x the league average").

The trade-off is honest: Dixon-Coles knows nothing about injuries, transfers,
managerial changes or fixture congestion, and treats a team's strength as slowly
varying. See [Known limitations](limitations.md#known-limitations).

### How the match model works (plain English)

1. Each team gets two numbers: an **attack** strength and a **defence** strength.
   One league-wide **home advantage** term is added on top.
2. Expected goals for each side come from those numbers:

   ```
   log(home xG) = intercept + home_advantage + attack[home] - defence[away]
   log(away xG) = intercept                  + attack[away] - defence[home]
   ```

   Ratings are on a log scale, so they read as multipliers: an attack of +0.24 means
   `exp(0.24) = 1.27`, i.e. 27% more goals than an average team. Goals are then
   (nearly) Poisson around those expectations.
3. Real football has more 0-0s and 1-1s, and fewer 1-0s and 0-1s, than independent
   Poisson draws predict. Dixon and Coles (1997) fix this with one parameter,
   **rho**, that reweights exactly those four scorelines, and the adjustments
   cancel so probabilities still sum to one. This is what makes it Dixon-Coles
   rather than "two Poissons".
4. Parameters are fitted by **maximum likelihood with time decay**: a match's weight
   halves every 365 days, so recent form counts more. A weak Gaussian prior on each
   rating (worth less than one match of data) keeps the fit well-posed, and is also
   the hook for handling promoted teams.
5. For a **neutral venue** (a cup final) the home-advantage term is dropped.

Fitted to the Premier League as of September 2026: home advantage **+0.17** (home
sides score ×1.18), rho **−0.08**, an average team scores 1.19 away from home.
How much those numbers move from season to season is covered under
[validation](results.md#what-the-data-says-about-the-parameters). The implementation is in
[src/tabletalk/model/dixon_coles.py](../src/tabletalk/model/dixon_coles.py), with the
gradient derived in the code comments.


## The league simulator

`python -m tabletalk simulate -c premier_league` fits the model on every result
so far, plays out the rest of the season 10,000 times, and reports how often each
team finished in each zone the config defines:

```
                        now  pts  exp pts range (10-90%) title top four top five top half relegation
Manchester City           1   15     82.2          71-93  58.1     98.0     99.1    >99.9          -
Arsenal                   2   12     78.6          68-89  34.6     95.5     97.5    >99.9          -
Liverpool                 6    9     66.7          56-78   4.1     62.5     73.8     96.2       <0.1
...
Tottenham Hotspur        20    2     42.8          32-54     -      0.9      2.0     16.5       22.5
Hull City                 8    8     40.4          28-53  <0.1      1.5      2.8     14.6       34.9
Ipswich Town             11    6     31.3          21-42     -     <0.1     <0.1      1.3       75.1
Coventry City            18    3     29.0          18-41     -     <0.1      0.2      1.7       80.0
```

(2026-27 after five matchdays. Tottenham finished 17th in each of the last two
seasons and have two points from five games. With the 365-day half-life their
longer record counts for more, so they are given 22.5% for relegation, where the
180-day version gave 40.9%. The model knows nothing of their wage bill or of a
possible change of manager.)

### How one simulated season works

1. Start from the real table.
2. Draw this season's team ratings from the fit's uncertainty (see
   [strength uncertainty](#strength-uncertainty)), so a team is a little stronger
   in some simulated seasons and a little weaker in others.
3. For each remaining fixture, draw a scoreline from the Dixon-Coles distribution
   with those ratings.
4. Add the simulated results to the real ones and rank the table with the
   config's points system and tiebreakers.

It takes under 3 seconds for 10,000 seasons (3.3 million matches). All runs are
drawn at once as a fixtures × runs array; the tables are built with a matrix
product; and the tables are sorted in bulk on points, goal difference and goals
scored. Only runs where teams are *still* level (about 0.5% for the Premier
League) go through the exact tiebreaker engine for the head-to-head criteria.

Scorelines are drawn by exact rejection sampling: propose from two independent
Poissons, accept with probability proportional to the Dixon-Coles correction.
A test checks it reproduces the model's score matrix over 400,000 draws.

With 10,000 runs, a 50% figure carries about ±1 percentage point of simulation
noise (95%), a 5% figure about ±0.4. `-` in the output means "in none of the
runs", which is not the same as impossible.

### Tiebreakers

The engine ([table.py](../src/tabletalk/simulation/table.py)) applies whatever
ordered list of criteria the config gives it. Season-wide criteria (goal
difference, goals scored, wins, ...) use every match; head-to-head criteria use
a mini-table of the matches among the tied teams. A run of head-to-head criteria
is applied as one block over the teams that were level when it started; a
config flag, `head_to_head_reapply`, adds the UEFA-style rule of running the block
again on any smaller group still level. The same results can give a different
table under a Premier League chain and a head-to-head-first chain, and there is a
test that shows exactly that.

The bulk sort and the exact engine are checked against each other: 6,000 random
low-scoring seasons (where ties are common), under both a Premier League chain and
a head-to-head-first chain, must produce identical tables.

### Replaying a past season

`--season 2025-26 --as-of 2026-01-01` forgets every result from that date on and
simulates the rest, which is how step 4's season-level backtest will work. From 1
January 2026 it gave Arsenal a 65.5% title chance and 84.9 expected points (they
won it with 85), and its three most likely relegation candidates were the three
clubs that went down. Its biggest miss was Manchester United: 4.8% for the top
four, and they finished third. One season is an anecdote; step 4 asks whether the
model's 5% events happen about 5% of the time across many seasons.

### Strength uncertainty

The simplest simulator uses today's best-estimate ratings for every simulated
season. That leaves out a real source of spread: **we do not know how good each
team is exactly**, and a team that is really a little better than its rating is
better in *all* its remaining matches, not just one. Ignoring that makes season
forecasts too sure of themselves, and the backtest showed exactly that (see
[the fix](results.md#fixing-the-early-over-confidence)).

So each simulated season draws its own ratings from the fit's uncertainty. That
uncertainty is not a tuned number: near its best fit, the log-likelihood is
shaped like a bowl, and **how sharply it curves says how well the data pin each
parameter down** (the Laplace approximation: covariance = inverse of the
curvature, the Hessian). It comes out wide for promoted teams and early in a
season, when there is little relevant data, and narrow for gaps between
established sides.

A useful discovery along the way: with a 180-day half-life, the model effectively
saw each team through only about 24 recent matches, which is worth about ±0.14
on a single rating (the 365-day half-life roughly doubles that sample). It is much less sure of each team than its confident
single-match forecasts suggest.

A second option, **drift**, let ratings wander through the season as a random
walk, with the step size derived from the half-life (exponential down-weighting
is what the optimal tracker of a random-walk strength, a Kalman filter,
produces). It was built and backtested, and it added nothing, which suggests
strength changes mostly *between* seasons (transfers, pre-season) rather than
steadily within them. It was removed from the code in October 2026; the
comparison is kept in [results.md](results.md).

`--fixed-strengths` switches uncertainty off, for comparison.

## Leagues, rules and data

Where the data comes from, how a league is added, and each league's rules:
which were verified against the official tables and which are assumptions.
How well each league is forecast is in [results.md](results.md).

### The data layer

**One schema, whatever the source**: `date, competition, season, home_team,
away_team, home_goals, away_goals, neutral, played`. A loader's only job is to
produce that frame; nothing downstream knows where a row came from. Validation is
strict and noisy on purpose (missing values, scores on unplayed fixtures, teams
playing themselves, duplicate fixtures, negative goals) because a quietly mangled
column would show up as plausible but wrong probabilities.

Played results and future fixtures live in the same frame, distinguished by
`played`: the model fits on the played rows, the simulator fills in the rest.

**Sources, each with a role** (in each league's config):

| Role | Source | Used for |
|---|---|---|
| `results` | [football-data.co.uk](https://www.football-data.co.uk/): free, one CSV per league-season back to the 1990s, with closing odds | Every season's scores, and the market benchmark |
| `results` | [football-data.org](https://www.football-data.org/) (free API key) | The current season's scores; the two must agree on every score they share |
| `fixtures` | football-data.org | The published fixture list with kick-off times, and match ids for locking |
| `check` | [openfootball](https://github.com/openfootball/football.json): public-domain, versioned in git | A third opinion on scores, in `data check` and the backtests (not the nightly run) |
| `context` | football-data.co.uk's second tiers (Championship, 2. Bundesliga, ...) | Model input only, for the `second_tier` promoted-team strategy; never tabulated, simulated or checked against the schedule |

The long history (2010-11 on) is there for the backtests and the promoted-team
prior; time decay means the current ratings rest almost entirely on the last
two seasons.

**Team-name normalisation.** Sources spell clubs differently ("Man United",
"Manchester Utd", "Manchester United FC"). Unreconciled, that silently splits one
club into several weaker teams. Names are resolved through
`configs/team_aliases.yaml` in two steps: a fingerprint (lower-case, accents and
punctuation stripped, club suffixes like "FC"/"AFC" dropped) that handles most
variation for free, then explicit aliases for the rest ("Spurs" is not a
fingerprint of "Tottenham Hotspur"). There is deliberately **no fuzzy fallback**:
an unknown name raises, listing close matches, so the fix is one line in the alias
file. `python -m tabletalk data check` reports all unknown names at once.

**Remaining fixtures come from the published fixture list**, never a generated
round robin. Results and fixtures are reconciled on `(season, home team, away
team)` rather than on the date, because dates move (postponements, TV
rescheduling) while the pairing does not. Played matches keep the results
source's score; the fixture entries that have not happened yet become the
remaining fixtures, with real dates.

Mismatches are reported, not patched over: a played result with no entry in the
fixture list almost always means a team name that failed to normalise in one source,
which would otherwise appear as a phantom extra team. `check_fixture_list`
separately verifies the loaded schedule against the config (team count, matches per
team, home/away balance, every pairing present the right number of times), so a
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
   `odds_preference` for the market benchmark), football-data.org
   `competition_code` for current results and fixtures, openfootball
   `league_code` as the cross-check, the second tier as a `role: context`
   source.
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
play-offs and European places.

**Every final table, every season.** `tests/test_official_tables.py` rebuilds
every completed season's final table (finishing order and points) for all five
leagues, 2010-11 to 2025-26, and compares it with the official one (fetched from
Wikipedia's structured season tables; a secondary source, checked against
official sources where they disagree). All 80 are identical. It checks the
results data, team names, each league's tiebreakers and the data files of
deductions, awarded results and play-offs at once.

### Rules that change by season

A league's rules are not fixed for all time: Ligue 1 went from 20 clubs to 18 and
changed its relegation places five times, and both Ligue 1 and Serie A changed
their tiebreakers.

- **`rule_changes`**: a config states the rules at the start of its data and then
  each change, with its season, reason and source. Everything that works on one
  season (tables, the simulator, the season backtest, the data checks) asks for
  that season's rules (`config.for_season`), so a backtest of 2016-17 uses 2016-17's
  team count, zones and tiebreakers. Every rule version is validated when the
  config loads.
- **Rule types**, each general and tested: `away_wins` (a tiebreaker);
  `ranking: points_per_match` and `completed_early` (Ligue 1 2019-20, stopped by
  COVID); `head_to_head_needs_all_meetings` (France uses head-to-head criteria only
  once both meetings are played); `position_playoffs`, a match for one particular
  place (Serie A's title and 17th v 18th), simulated as one match at a neutral
  ground, one at the higher-ranked club's ground, or two legs on aggregate; and
  `playoff_match`, the last criterion of the Premier League and the Bundesliga
  (below).
- **Results as data**: results awarded off the pitch
  (`configs/awarded_results.yaml`; the table uses the awarded result, the match
  model the real one, including France's rule that a forfeit counts the win but not
  the goals), and play-offs that were actually played
  (`configs/playoff_results.yaml`).

**The play-off at the end of the chain.** The last Premier League and Bundesliga
tiebreaker is a one-off match on a neutral ground. When a simulated season
reaches it, the simulator plays the match with the match model and no home
advantage, a draw settled 50/50 for extra time and penalties. A displayed table
lists such clubs alphabetically. Two clubs level on all earlier criteria is
vanishingly rare.

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

It matters to the backtest: at the 75% checkpoint of 2023-24 (30 March 2024), the
real table had Nottingham Forest 18th on 21 points. A table built without
deductions had them on 25 and safe, so the "table as it stands" baseline would
have been using a table nobody saw at the time.

### Premier League

Checked 2026-09-26: 20 teams, 38 matches each, 3/1/0 points; tiebreakers goal
difference, goals scored, head-to-head points, head-to-head away goals
(Handbook Rule C.17), then a play-off on a neutral ground; bottom three relegated
with no play-off. Deductions in one loaded season, 2023-24: Everton −8 and
Nottingham Forest −4 (without them, Everton would be 12th instead of 15th).
Earlier Premier League deductions predate the data, and Leicester City's six
points in 2025-26 were in the Championship, which is never tabulated.

Reported zones are **league positions** (title, top four, top five, top half,
relegation), not "qualifies for the Champions League". Which European place a
position earns depends on UEFA coefficients and on domestic cup winners; neither
is modelled while the scope is domestic leagues, so quoting a qualification
probability would overstate what the model knows.

### Bundesliga

From the DFL's rulebook, the Spielordnung (SpOL), editions of 22 August 2019 and
6 March 2026, identical on these points; recorded with sources in
[configs/competitions/bundesliga.yaml](../configs/competitions/bundesliga.yaml).

| rule | Bundesliga | source |
|---|---|---|
| clubs, matches | 18, 34 each | the data (every season 2010-11 to 2026-27) |
| points | 3 / 1 / 0 | SpOL § 2 Nr. 3 a) |
| tiebreakers | goal difference, goals scored, **aggregate score of the two meetings**, away goals in those meetings, **all away goals**, then a play-off on a neutral ground | SpOL § 2 Nr. 3 c) |
| relegation | 17th and 18th | SpOL § 3 Nr. 2 |
| relegation play-off | 16th v the 2. Bundesliga's 3rd, two legs | SpOL § 3 Nr. 2; held every season since 2008-09 |
| points deductions | none in any loaded season | last ones 1993-94, 1999-2000, 2003-04 |

England uses head-to-head *points*; Germany uses the head-to-head *aggregate
score* (a 3-0 win and a 0-1 defeat beats a 1-0 win and a 0-3 defeat), then away
goals, including away goals over the whole season. Tests build tables where each
Bundesliga criterion decides and the Premier League chain would decide
differently.

Flagged:

- **Not confirmed by a rule text:** "18 clubs" (the SpOL only fixes 32 to 36 clubs
  across both divisions), and the tiebreaker text before 2019-20 (no older edition
  found; the same order is assumed). Every final table matches the official one,
  which confirms goal difference and goals scored; no real tie went further, so
  the head-to-head criteria are tested on hand-built tables only.
- **Assumption:** for three or more clubs level on points, goal difference and
  goals, the head-to-head criteria use the mini-table of all their meetings (the
  rule is written for two clubs).
- **Assumption:** during a season the DFL applies head-to-head criteria only once
  both meetings have been played; TableTalk's *mid-season* table always applies
  the full chain. Simulated final tables are unaffected.
- The relegation play-off is reported as its own zone, "finishes 16th"; the
  play-off against the second-tier side is not simulated.

Data notes: "ß" and numbered prefixes ("1. FC Köln", "TSG 1899 Hoffenheim") need
aliases; accents don't (the matching key strips them). Clubs promoted through the
play-off count as promoted: they are simply the clubs not in last season's
Bundesliga.

### La Liga

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
  neutral-ground play-off become a coin flip.
- **Three-way ties.** The 2025-26 text can be read as going back to the pair
  straight after mini-league points, where the engine applies the whole
  head-to-head block to the group first. La Liga had 14 three-way ties on points in
  these 16 seasons and the two readings never gave a different order.
- **Positions, not outcomes.** In 2014-15 Elche finished 13th and were relegated
  for unpaid debts, and Eibar, in the drop zone, stayed up. Zones are finishing
  positions, so "relegation" means "finishes 18th to 20th".

Data notes: reserve sides are different clubs ("Barcelona B"), and
football-data.co.uk spells one club two ways ("Cultural Leonesa" and "Leonesa").

### Serie A

The FIGC sets Serie A's tie rules each season by a ruling that departs from its
general rules (art. 51 NOIF); the rulings for 2019-20, 2023-24, 2024-25, 2025-26
and 2026-27 were read. Ties go to the *classifica avulsa* (points, then goal
difference, in the matches among the clubs level; then overall goal difference,
goals, and a drawing of lots). From 2022-23 a tie on points **for the title or
for 17th v 18th** is settled by a play-off instead: in 2022-23 one match at a
neutral ground (the only one played so far: Verona 3-1 Spezia); from 2023-24 one
match at the higher-ranked club's ground for the title, and two legs on aggregate
for 17th v 18th.

Flagged: the 2022-23 ruling and those before 2019-20 were not found (the formats
are taken from the play-off played and the 2019-20 ruling); play-offs use
best-estimate ratings; and from 2026-27 no play-off is held if a club is in a
European final, which is not modelled.

Found by the official-table check: eleven deductions (Bologna 2010-11; Atalanta
2011-12; Siena, Atalanta, Sampdoria and Torino in 2012-13, after the betting
scandal; Parma 2014-15; Chievo 2018-19; Juventus 2022-23, recorded as it happened:
−15, restored, then −10), Verona v Roma 2020-21 (played 0-0, awarded 3-0), and two
errors in Wikipedia's tables (a Lazio deduction in 2017-18 and 2018-19 that never
happened, and the 2022-23 order before the play-off). One date is not found (part
of Bologna's 2010-11 deduction) and Parma's split between February and March 2015
is uncertain; neither season is in the report seasons.

### Ligue 1

Rules (LFP, as reported by ligue1.com and Orange; the regulations before 2025 were
not found): overall goal difference first, then head-to-head (only once both
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

Found by the official-table check: four deductions (AC Ajaccio 2012-13; Nice and
Lyon 2021-22, both after crowd trouble; Montpellier 2023-24) and two forfeits
counted as a win without goals (Nantes v Bastia 2013-14, Bastia v Lyon 2016-17).
La Liga's check found one (Almería 2014-15).

## Reference

Dixon, M. J. and Coles, S. G. (1997). *Modelling Association Football Scores and
Inefficiencies in the Football Betting Market.* Journal of the Royal Statistical
Society: Series C, 46(2), 265-280.
