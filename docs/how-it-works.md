# How it works

Probabilistic football forecasting: a Dixon-Coles match model feeding configurable
competition simulators, producing the kind of numbers newspapers print as
"supercomputer predicts the title race" — but with the method written down, the
assumptions flagged, and the forecasts checked against what actually happened.

Why the project is built in three layers, how the match model turns two teams into scoreline probabilities, and how the season simulator plays the rest of a season 10,000 times.

Contents:

- [Why this architecture](#why-this-architecture)
- [The league simulator](#the-league-simulator)
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

A second option, **drift**, lets ratings wander through the season as a random
walk, with the step size derived from the half-life (exponential down-weighting
is what the optimal tracker of a random-walk strength, a Kalman filter,
produces). It is implemented and tested, but switched off: in the backtest it
added nothing, which suggests strength changes mostly *between* seasons
(transfers, pre-season) rather than steadily within them.

`--fixed-strengths` switches uncertainty off, for comparison.

## Reference

Dixon, M. J. and Coles, S. G. (1997). *Modelling Association Football Scores and
Inefficiencies in the Football Betting Market.* Journal of the Royal Statistical
Society: Series C, 46(2), 265-280.
