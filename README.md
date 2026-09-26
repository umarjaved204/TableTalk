# TableTalk

Probabilistic football forecasting: a Dixon-Coles match model feeding configurable
competition simulators, producing the kind of numbers newspapers print as
"supercomputer predicts the title race" — but with the method written down, the
assumptions flagged, and the forecasts checked against what actually happened.

**Status: Phase 1 complete.** Data layer, Dixon-Coles match model, league
simulator and both backtests (match-level and season-level, with calibration) are
done and tested for the Premier League. The headline results are
[below](#results-does-it-work-phase-1-done); Phase 2 adds the other big leagues.

```
python -m tabletalk competitions                         # what is configured
python -m tabletalk data fetch --competition premier_league --refresh
python -m tabletalk data check --competition premier_league
python -m tabletalk ratings    --competition premier_league   # fitted ratings + next fixtures
python -m tabletalk evaluate   --competition premier_league   # match-level backtest
python -m tabletalk simulate   --competition premier_league   # title / top-four / relegation odds
python -m tabletalk simulate   --competition premier_league --table                 # projected final table
python -m tabletalk simulate   --competition premier_league --season 2025-26 --as-of 2026-01-01   # replay a past season
python -m tabletalk evaluate-seasons --competition premier_league                   # season-level backtest
```

The results notebook, [notebooks/premier_league_results.ipynb](notebooks/premier_league_results.ipynb),
puts current predictions, ratings, both backtests and the calibration charts in one place.

---

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
([src/tabletalk/config.py](src/tabletalk/config.py)), so a typo is a clear error
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
varying. See [Known limitations](#known-limitations).

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
   halves every 180 days, so recent form counts more. A weak Gaussian prior on each
   rating (worth less than one match of data) keeps the fit well-posed, and is also
   the hook for handling promoted teams.
5. For a **neutral venue** (a cup final) the home-advantage term is dropped.

Fitted to the Premier League as of September 2026: home advantage **+0.17** (home
sides score ×1.19), rho **−0.11**, an average team scores 1.15 away from home.
How much those numbers move from season to season is covered under
[validation](#what-the-data-says-about-the-parameters). The implementation is in
[src/tabletalk/model/dixon_coles.py](src/tabletalk/model/dixon_coles.py), with the
gradient derived in the code comments.

---

## Repository layout

```
configs/
  competitions/premier_league.yaml   # one file per competition: rules, zones, data sources
  team_aliases.yaml                  # canonical team names + every source's spelling
src/tabletalk/
  config.py             # typed, validated view of a competition config
  paths.py              # where configs and data live
  cli.py, __main__.py   # `python -m tabletalk ...`
  data/
    schema.py           # THE match schema every source must produce
    seasons.py          # season labels ("2025-26") and source-specific codes
    normalise.py        # team-name normalisation
    loaders/
      base.py               # MatchLoader interface
      football_data_uk.py   # results
      openfootball.py       # published fixture lists
    fixtures.py         # the remaining fixtures; checking a schedule against the config
    reconcile.py        # merging results with the published fixture list
    dataset.py          # assemble, filter and summarise a competition's matches
  model/
    dixon_coles.py      # likelihood, analytic gradient, fitting, predictions
    promoted.py         # promoted-team strategies: prior / second_tier / none
  evaluation/
    metrics.py          # log loss, Brier score, ranked probability score
    backtest.py         # rolling-origin match-level backtest vs a base-rate baseline
    season_backtest.py  # replay past seasons from checkpoints; zone and position scores
    calibration.py      # reliability tables with Wilson intervals
    plots.py            # calibration and probability charts, light and dark
  simulation/
    table.py            # league tables and the config-driven tiebreaker engine
    league.py           # LeagueSimulator: 10,000 seasons, zone probabilities
                        # (KnockoutSimulator arrives in Phase 3)
notebooks/              # results notebook (executed, outputs included)
reports/figures/        # charts used in this README
tests/                  # pytest; runs offline
data/raw/               # untouched downloads (gitignored)
data/processed/         # assembled standard-schema CSVs (gitignored, rebuilt on demand)
```

## The data layer (Phase 1, done)

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
[Promoted teams](#promoted-teams)). The long history is there for the backtests
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

### Adding a competition

1. Copy `configs/competitions/premier_league.yaml`, change the rules (team count,
   points, tiebreaker order, zones, data source and seasons).
2. Point it at a results source and a fixtures source (for La Liga:
   `division: SP1` and `league_code: es.1`).
3. Run `python -m tabletalk data check -c <your_competition>` and add any new team
   spellings it reports to `configs/team_aliases.yaml`.
4. Fit and simulate. If either needed a code change, that is a design bug.

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

## The match model: validation (Phase 1, done)

### Is the implementation right?

Before asking whether the model is *good*, check that it is *correct*:

- **The gradient matches finite differences** to about 1e-7 relative error. The
  optimiser uses a hand-derived gradient; an almost-right gradient still converges,
  just to the wrong place, so this is the first check.
- **Parameter recovery.** Simulate 11,200 matches from known ratings using the exact
  Dixon-Coles score distribution, fit the model, and confirm it gets the ratings,
  home advantage and rho back within sampling error. This is what catches a flipped
  sign on defence or a tau correction applied to the wrong scoreline.

### Does it beat knowing nothing?

`python -m tabletalk evaluate` runs a **rolling-origin backtest**: for each week of
a completed season, fit using only results before that week, forecast the week's
matches, move on. No forecast ever sees a result from its own future. Every model
is compared with a **baseline** that ignores the teams and predicts the league's
historical home/draw/away frequencies.

Scores are *proper scoring rules* (lower is better): **log loss**, **Brier score**,
and **ranked probability score**, which respects that a draw is "closer" to a home
win than an away win is.

The headline covers **12 seasons, 2012-13 to 2025-26, 4,560 matches**. The two
COVID-affected seasons are reported separately; that exclusion was decided and
written into the config, with the reason, before any backtest was run.

| | log loss | Brier | RPS | vs baseline |
|---|---|---|---|---|
| Dixon-Coles | **0.968** | **0.574** | **0.197** | **−9.2% log loss** |
| Base rates | 1.066 | 0.644 | 0.231 | — |

The model beats the baseline in **all 14 seasons tested**, the COVID ones included.
Its worst season is 2015-16 (log loss 1.035 against the baseline's 1.088): the
season Leicester won the league as 5000-1 outsiders. A model built on "strength
drifts slowly" should find that season hardest, and it does.

**The COVID seasons on their own** (2019-20 and 2020-21, 760 matches): still 7.2%
better than the baseline, despite 2020-21 being played without crowds.

### What the data says about the parameters

Fitting each season on its own shows how much the "fixed" parameters actually move:

- **Home advantage** averages +0.24 in normal seasons (home sides score ×1.27), with
  a standard deviation of 0.07 between seasons. In 2020-21, behind closed doors, it
  was **+0.007**, essentially zero, and that was the only season in the data with
  more away wins than home wins. It has also **declined**, from about +0.27 in the
  early 2010s to about +0.18 recently, and even with crowds 2024-25 came in at
  +0.06. Time decay lets the current estimate (+0.17) follow that drift.
- **rho** is noisy: per season it ranges from −0.16 to +0.14, averaging −0.045. It
  only reshapes four scorelines, so it needs a lot of data; simulations show the
  same (from 2,240 simulated matches with a true rho of −0.10, fitted values ranged
  from −0.02 to −0.14). The current fit's −0.11 comes from about 240
  effective matches and is probably overstated.
- **Time decay** (measured on 2023-24 to 2025-26): log loss is flat for half-lives
  between 180 and 365 days (0.9812 / 0.9805 / 0.9811) and clearly worse below 120.
  The configured 180 days is kept rather than switching to whichever value scores
  best on the test seasons, which would be tuning on the test set.
- Matches whose decay weight falls below 0.001 (more than ~5 years old) are left
  out of each fit. Across all 380 pairings this season, that changes no win, draw or
  loss probability by more than 0.0005, and it makes fits about three times faster.

### Promoted teams

A team promoted this season has few or no recent Premier League results. Fitted
naively, it is rated on a handful of matches: with five games played, the
unadjusted model puts newly promoted Hull City **5th in the league** on the
strength of two wins.

How public models handle this: nearly all of them (Elo-style systems,
FiveThirtyEight's SPI, Opta's power rankings) sidestep it by rating more than one
division on a single scale, so a promoted team arrives with a rating earned below.
Dixon and Coles' own paper fitted league and cup data across English divisions.
Academic goal models more often shrink sparse teams toward a common prior.
TableTalk implements both and lets the backtest decide:

- **`prior`**: start each promoted team at the average first-season rating of the
  45 teams promoted in the previous 15 seasons (they scored ×0.77 and conceded
  ×1.21 an average team's goals), with a spread equal to how much those teams
  varied. Their own results then pull them away from it.
- **`second_tier`**: fit the Championship alongside the Premier League, with its
  own goal-rate offset, so promoted teams carry a Championship-earned rating onto
  the Premier League scale via the clubs that move between divisions.
- **`none`**: no special handling, as a reference point.

Log loss over the 12 seasons (36 promoted teams):

| matches | n | `none` | `prior` | `second_tier` |
|---|---|---|---|---|
| all | 4,560 | 0.972 | **0.968** | 0.970 |
| promoted team involved | 1,296 | 0.932 | **0.917** | 0.930 |
| early season (games 1-10), promoted team involved | 340 | 0.930 | **0.904** | 0.932 |

Paired comparisons on the same matches (95% intervals):

- `prior` beats `none` overall (−0.0042 ± 0.0026) and on promoted-team matches
  (−0.0146 ± 0.0093).
- `prior` beats `second_tier` on promoted-team matches (−0.0129 ± 0.0073), and by
  more in the first ten games (−0.028 ± 0.020).
- `second_tier` is indistinguishable from doing nothing.

Bias in forecast goal difference for promoted teams (forecast minus actual, goals
per game, from the promoted team's side):

| | games 1-10 | games 11-38 |
|---|---|---|
| `none` | +0.23 ± 0.17 | −0.03 ± 0.10 |
| `prior` | **+0.15 ± 0.16** | −0.04 ± 0.10 |
| `second_tier` | +0.39 ± 0.17 | +0.08 ± 0.10 |

**Why the Championship approach loses: the winner's curse.** A club is promoted
partly *because* its Championship results flattered it, so a rating built from
those results is biased upward. The clubs `second_tier` got most wrong were the
ones that ran away with the division: Burnley 2023-24 (forecast −0.39 goals per
game in their first ten matches, actual −1.7), Burnley and Leeds 2025-26.
Multi-division rating systems have to correct for exactly this; the `prior`
approach avoids it because it is measured on promoted teams' actual Premier
League results.

**Decision: `prior`.** It is the best of the three on every measure above, and the
only one whose early-season bias is not distinguishable from zero.

A lesson in statistical power along the way: an earlier version of this backtest
covered only three seasons (nine promoted teams) and could not separate `prior`
from `none` at all (a difference of −0.0005 ± 0.019). Loading 2010-11 onwards
quadrupled the sample and turned "no detectable difference" into a clear result.
With nine teams, the honest conclusion was "we cannot tell", not "it doesn't
matter".

Open questions, deliberately not tuned against the same test seasons:

- **Promoted teams are getting weaker.** Their average first-season net rating
  fell from −0.38 (2011-12 to 2017-18) to −0.53 (2018-19 to 2025-26), consistent
  with the widely reported gap between the Premier League and the Championship
  growing. A prior weighting recent seasons more heavily would track that; it
  likely explains the remaining +0.15 early-season bias.
- **A corrected `second_tier`**, shrinking Championship ratings toward the promoted
  prior, might combine team-specific information with the winner's-curse
  correction.
- **Squad value** (e.g. Transfermarkt) is the one signal that separates a
  well-funded promoted team from a weak one before either plays; it needs a new
  data source.

## The league simulator (Phase 1, done)

`python -m tabletalk simulate -c premier_league` fits the model on every result
so far, plays out the rest of the season 10,000 times, and reports how often each
team finished in each zone the config defines:

```
                        now  pts  exp pts range (10-90%) title top four top five top half relegation
Manchester City           1   15     81.6          73-90  61.1     99.3     99.8      100          -
Arsenal                   2   12     78.3          70-87  35.0     98.2     99.3      100          -
Brighton & Hove Albion    3   10     65.8          57-75   2.3     65.1     77.7     97.7          -
...
Tottenham Hotspur        20    2     36.8          28-46     -     <0.1     <0.1      2.1       47.6
Ipswich Town             11    6     32.9          25-41     -        -        -      0.4       73.3
Coventry City            18    3     30.0          22-38     -        -        -      0.1       84.9
```

(2026-27 after five matchdays. Tottenham finished 17th in each of the last two
seasons and have two points from five games, so the model rates them the
weakest established side in the league; it knows nothing of their wage bill or
of a possible change of manager.)

### How one simulated season works

1. Start from the real table.
2. For each remaining fixture, draw a scoreline from the match model's score
   matrix: take the running total of the flattened matrix and see where a
   uniform random number lands in it.
3. Add the simulated results to the real ones and rank the table with the
   config's points system and tiebreakers.

It takes about 1.5 seconds for 10,000 seasons (3.3 million matches). Each
fixture's score matrix is computed once; all runs are drawn at once as a
fixtures × runs array; the tables are built with a matrix product; and the
tables are sorted in bulk on points, goal difference and goals scored. Only runs
where teams are *still* level (about 0.5% for the Premier League) go through the
exact tiebreaker engine for the head-to-head criteria.

With 10,000 runs, a 50% figure carries about ±1 percentage point of simulation
noise (95%), a 5% figure about ±0.4. `-` in the output means "in none of the
runs", which is not the same as impossible.

### Tiebreakers

The engine ([table.py](src/tabletalk/simulation/table.py)) applies whatever
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

### Assumption: strengths stay fixed within a simulated season

Every simulated season uses today's ratings: a team does not improve within a
simulation because it won its simulated matches. This is the standard approach
and easy to explain, but real ratings drift over a season, so it understates the
spread of outcomes somewhat: surprise title challenges and collapses are a little
more common in reality than in the simulation. Updating ratings as simulated
results come in would address it at a cost in speed and clarity.

## Results: does it work? (Phase 1, done)

Two backtests, both run on 12 completed seasons (2012-13 to 2025-26, leaving out
the two COVID-affected seasons, a decision recorded in the config before any
results were seen). Everything below is reproduced by
[the results notebook](notebooks/premier_league_results.ipynb) or by
`python -m tabletalk evaluate` and `python -m tabletalk evaluate-seasons`.

### Match forecasts are well calibrated

Every match was forecast from a fit using only earlier results. Grouping the
forecasts by the probability they gave:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="reports/figures/match-calibration-dark.png">
  <img alt="Calibration of home-win, draw and away-win forecasts: all three track the diagonal closely" src="reports/figures/match-calibration-light.png">
</picture>

When the model gave the home side 60-70%, the home side won **67.7%** of the
time (95% interval 63.5-71.7%). Across all bins the average gap from the diagonal
is 1.6 percentage points for home wins, 0.9 for draws and 1.4 for away wins.
Overall log loss is **9.2% better than the base-rate baseline** (0.968 against
1.066).

The one thing it cannot do is **pick out draws**. Its draw forecasts are well
calibrated but barely vary: 3,306 of 4,560 fall between 20% and 30%, and none go
above 40%. Team strengths say who is likely to win, much less whether a match will
finish level. This is a known property of Dixon-Coles.

### Season forecasts beat both baselines

Each season was replayed from four checkpoints (pre-season, then after 25%, 50%
and 75% of the matches), simulated 5,000 times from what was known at that
point, and scored against the real final table. Brier-score skill, as % better
than each baseline:

| vs **uniform** (knows nothing) | title | top four | top five | top half | relegation |
|---|---|---|---|---|---|
| pre-season | 25.5 | 39.5 | 52.1 | 37.8 | 25.6 |
| 25% played | 48.0 | 58.6 | 65.5 | 51.6 | 42.8 |
| 50% played | 59.2 | 81.7 | 85.7 | 66.2 | 54.7 |
| 75% played | 67.8 | 83.2 | 85.7 | 73.3 | 75.2 |

| vs **persistence** (the table as it stands) | title | top four | top five | top half | relegation |
|---|---|---|---|---|---|
| pre-season | 46.9 | 35.5 | 46.1 | 41.7 | 36.8 |
| 25% played | 63.0 | 53.2 | 48.3 | 36.9 | 37.5 |
| 50% played | 53.5 | 56.1 | 54.1 | 27.6 | 36.9 |
| 75% played | 54.2 | 35.6 | 54.1 | 38.3 | **−26.4** |

"Persistence" is the naive pundit: the final table will look like the current
one (pre-season, last season's table with the promoted teams at the bottom). The
model beats it everywhere except one cell. Finishing positions tell the same
story: the expected position is 2.8 places off pre-season (persistence: 3.3),
falling to 1.3 with a quarter of the season left (persistence: 1.4). The
pre-season favourite won the title in 5 of 12 seasons, with an average
favourite's probability of 58%.

### Where it goes wrong: early over-confidence, late stubbornness

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="reports/figures/season-calibration-dark.png">
  <img alt="Season-forecast calibration: early-season forecasts fall below the diagonal at high probabilities; later ones track it" src="reports/figures/season-calibration-light.png">
</picture>

- **Early in a season, confident forecasts are too confident.** Forecasts of
  70-99% made pre-season came true 71% of the time against an average forecast of
  87%; at 25% played, 77% against 87%. By mid-season they agree (86.5% against
  86.6%).
- **Late in a season, it hedges where the table has already decided.** With a
  quarter of the season left, the bottom three stayed there in 9 of 12 seasons,
  and the model lost to "the table as it stands" by holding on to ratings:
  Leicester 2022-23 were in the bottom three and given a 21% relegation chance
  (they went down); Swansea 2017-18 got 34% (they went down).

Both trace back to one simplification in the simulator: **each team's strength
is fixed within a simulated season.** Over a long horizon real strength drifts
(transfers, injuries, managers), so forecasts made months ahead are too sure.
Late on, ratings partly built from last season lag behind a genuinely declining
team that the table has already caught. The natural fix is to give each team's
rating uncertainty that grows with the forecast horizon, drawing fresh ratings
for every simulated season. It is the first thing to try in the next iteration;
it is not tuned against these results here.

Caveats: twelve seasons means twelve champions and 36 relegated teams, so the
rare-event numbers carry real uncertainty; and pooled season-level observations
are not independent (the same team appears at four checkpoints, and exactly one
team wins each title), so the calibration intervals are narrower than they should
be.

## Tests

```
python -m pytest
```

166 tests, no network access required (the integration test skips when the raw
data is not cached). They cover the parts that are easy to get subtly wrong and hard
to notice:

- **Data:** config validation, team-name normalisation (idempotence, ambiguous
  aliases), schema validation, season labels, both loaders, reconciling results
  against the schedule (no double counting, no lost match, orphaned results
  detected), and the fixture-list checks.
- **Model:** each tau cell, the adjustments cancelling exactly, the objective
  against a hand-computed likelihood, the gradient against finite differences,
  parameter recovery from simulated data, neutral venues, and fitting ignoring any
  result on or after the fit date.
- **Promoted teams:** detection, a newcomer starting exactly at its prior, and the
  prior for a season never seeing that season's results.
- **Evaluation:** each scoring rule on worked examples, RPS respecting outcome
  order where Brier cannot, and the backtest never forecasting from the future.
- **Tables and tiebreakers:** hand-built tables for every criterion in the Premier
  League chain (goal difference, goals scored, head-to-head points, head-to-head
  away goals, coin flip), three- and four-way head-to-head ties, the re-apply
  rule, and the same results ranking differently under two chains.
- **Simulator:** a title race decided by one match matching that match's
  probability, a finished season coming out certain, seeds being reproducible,
  probabilities summing correctly, the bulk sort agreeing with the exact engine
  on 6,000 random seasons, and a real season replayed from a date.
- **Calibration and season backtest:** Wilson intervals, a calibrated forecaster
  landing on the diagonal and an over-confident one being caught, position RPS
  rewarding near misses, checkpoint dates, and the persistence baseline.
- **CLI:** every command runs end to end on the real data and exits cleanly.

Knockout aggregate and penalty handling will get the same treatment in Phase 3.

## Roadmap

- **Phase 1 — core model + Premier League.** Data layer ✅ · Dixon-Coles ✅ ·
  match-level backtest vs a base-rate baseline ✅ · LeagueSimulator ✅ · season-level
  backtest, calibration plots and results notebook ✅
- **Next iteration of the model**, before or alongside Phase 2: rating uncertainty
  that grows with the forecast horizon, which the season backtest points to (see
  [where it goes wrong](#where-it-goes-wrong-early-over-confidence-late-stubbornness)).
- **Phase 2 — La Liga, Serie A, Bundesliga, Ligue 1**, by config; per-league fit
  and per-league validation. openfootball already covers all four schedules
  (`es.1`, `it.1`, `de.1`, `fr.1`), including the 18-team leagues.
- **Phase 3 — European competitions**, deliberately deferred until the domestic
  leagues produce good, validated results. It then needs the KnockoutSimulator
  (two legs, aggregate, extra time, penalties), the hybrid
  league-phase-then-bracket format, a European results source, and a way to put
  teams from different leagues on one strength scale.
- **Later** — API, website. Not in scope here.

## Known limitations

- **Nothing about teams beyond results.** No injuries, suspensions, transfers,
  managerial changes, European or cup fixture congestion, or motivation at the end
  of a season.
- **Promoted teams start from one shared prior**, however they were built, and it
  weights a promoted team from 2011 the same as one from 2025 although promoted
  sides have been getting weaker. See [Promoted teams](#promoted-teams).
- **Home advantage and rho are single numbers per fit.** Home advantage differs by
  ground and has drifted downwards for a decade; rho is poorly determined by a
  time-decayed sample.
- **Strengths are fixed within a simulated season.** The season backtest shows
  the cost: forecasts made months ahead are over-confident, and late in a season
  the model trusts ratings over a table that has already moved. See
  [where it goes wrong](#where-it-goes-wrong-early-over-confidence-late-stubbornness).
- **It cannot pick out likely draws.** Draw forecasts are calibrated but almost
  all sit between 20% and 30%.
- **Strength is assumed to drift slowly.** Time decay is a blunt instrument: it
  cannot capture a team that changes overnight.
- **Early-season forecasts are weakly informed** by the current season and lean on
  previous ones.
- **Cross-league strengths are not comparable** until Phase 3 addresses it: a
  strong team in a weak league looks better than it is.
- **Cups are not modelled**, so European places that depend on cup winners are
  indicative.
- **Point estimates, not intervals.** Simulation captures the randomness of
  football, not the uncertainty in the fitted parameters themselves.
- **One home advantage for everyone.** Some grounds are genuinely harder to visit
  than others; the model does not know that.
- **The schedule is taken as given.** Postponements and rearrangements are only
  picked up when the fixture source is refreshed.

## Reference

Dixon, M. J. and Coles, S. G. (1997). *Modelling Association Football Scores and
Inefficiencies in the Football Betting Market.* Journal of the Royal Statistical
Society: Series C, 46(2), 265-280.
