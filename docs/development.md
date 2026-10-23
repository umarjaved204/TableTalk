# Development

Getting the code, where everything lives, and the tests.

Contents:

- [Getting the code](#getting-the-code)
- [Commands](#commands)
- [Repository layout](#repository-layout)
- [Tests](#tests)

[Back to the README](../README.md)

## Getting the code

```
git clone --single-branch --branch main https://github.com/umarjaved204/TableTalk.git
```

`--single-branch --branch main` downloads only the code. A plain `git clone`
also downloads the `data` branch, where the nightly run adds a full copy of
every prediction each day (see [the nightly schedule](runbook.md#the-nightly-schedule)),
so it grows by tens of megabytes a season.

## Commands

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
python -m tabletalk benchmark  --competition premier_league   # model vs bookmakers' closing odds
python -m tabletalk tune       --competition premier_league   # choose half-life / ridge sd on the tuning seasons
```

The results notebook, [notebooks/premier_league_results.ipynb](../notebooks/premier_league_results.ipynb),
puts current predictions, ratings, both backtests and the calibration charts in one place.

## Repository layout

```
configs/
  competitions/*.yaml                # one file per league: rules (versioned by season), zones, data sources
  team_aliases.yaml                  # canonical team names + every source's spelling
  points_deductions.yaml             # official points deductions, dated, with sources
  awarded_results.yaml               # results changed off the pitch (tables only)
  playoff_results.yaml               # position play-offs actually played
scripts/
  fetch_official_tables.py           # official final tables from Wikipedia, as test fixtures
  check_publish.sh                   # the publish job's checks on each nightly commit
contracts/                           # the data contract: README and JSON Schemas
web/                                 # the website (web/README.md)
deploy/                              # Cloudflare deploy config and the go-live check
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
      football_data_uk.py   # results and closing odds, every season
      football_data_org.py  # current results and the fixture list (API key)
      openfootball.py       # a third opinion on scores (data check, backtests)
    fixtures.py         # the remaining fixtures; checking a schedule against the config
    reconcile.py        # merging results with the published fixture list
    source_comparison.py  # the one-off comparison that chose the fixture source
    dataset.py          # assemble, filter and summarise a competition's matches
    deductions.py       # points deductions from configs/points_deductions.yaml
    awarded.py          # results awarded off the pitch
    playoffs.py         # position play-offs actually played
  model/
    dixon_coles.py      # likelihood, analytic gradient, fitting, predictions
    promoted.py         # promoted-team strategies: prior / second_tier / none
  evaluation/
    metrics.py          # log loss, Brier score, ranked probability score
    backtest.py         # rolling-origin match-level backtest vs a base-rate baseline
    market.py           # bookmaker odds -> probabilities; model vs market benchmark
    tuning.py           # grid search on the tuning seasons only
    season_backtest.py  # replay past seasons from checkpoints; zone and position scores
    calibration.py      # reliability tables with Wilson intervals
    plots.py            # calibration and probability charts, light and dark
  simulation/
    table.py            # league tables and the config-driven tiebreaker engine
    league.py           # LeagueSimulator: 10,000 seasons, zone probabilities
                        # (KnockoutSimulator arrives in Phase 3)
    uncertainty.py      # rating uncertainty drawn per simulated season
  pipeline/
    update.py           # the nightly update, league by league
    checks.py           # safety checks on fixtures and outputs
    snapshot.py         # the published snapshot; seeds, config and pipeline hashes
    locks.py            # pending predictions and the hash-chained lock log
    track_record.py     # scoring locks against base rates and the market
    known_results.py    # results kept while a source stops listing them
    state.py            # working files: is today done, known results
    raw_manifest.py     # the record of past-season downloads
    awarded.py          # awarded matches: draft entries, provisional tables
notebooks/              # results notebook (executed, outputs included)
reports/figures/        # charts used in this README
tests/                  # pytest; runs offline
data/raw/               # untouched downloads (gitignored)
data/processed/         # assembled standard-schema CSVs (gitignored, rebuilt on demand)
```

## Tests

```
python -m pytest
```

About 400 tests, about two minutes, no network access required (the
integration tests skip when the raw data is not cached). They cover the parts that are easy to get subtly wrong and hard
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
- **Strength uncertainty:** the score sampler reproducing the model's score matrix
  over 400,000 draws, a team with no data being exactly as uncertain as its prior,
  and uncertainty widening outcomes without moving the average.
- **CLI:** every command runs end to end on the real data and exits cleanly.

Knockout aggregate and penalty handling will get the same treatment in Phase 3.
