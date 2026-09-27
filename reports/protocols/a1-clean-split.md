# Protocol A1: tune on earlier seasons, report on later ones

Written 2026-09-27, **before** any backtest was run on the split below. Results
go in the README; this file records what was decided in advance, so the reader
can check the rules were not bent to fit the numbers.

## Why

The leakage audit found no leak in the promoted-team prior: for every backtest
season it is built only from earlier seasons, and it is identical when every
later season is deleted from the data (now a test). But several choices were
made by looking at the same 12 seasons the headline results are reported on:

| choice | how it was made | used the headline seasons? |
|---|---|---|
| half-life 180 days | picked a priori as a round number; later *checked* on 2023-24 to 2025-26 (flat between 180 and 365) and kept | checked on them, so its survival is not independent of them |
| ridge prior sd 1.0 | picked a priori to be weak (well-posedness, not shrinkage); never tuned | no |
| weight cutoff 0.001 | a speed setting; checked that it moves no probability by more than 0.0005 on the 2026-27 fixtures | no (not a performance choice) |
| promoted strategy `prior` | chosen by the match backtest on all 12 seasons | **yes** |
| rating uncertainty on, drift off | chosen by the season backtest on all 12 seasons | **yes** |

So the headline numbers are partly in-sample. The fix is a chronological split.

## The split (Premier League)

- **Tune:** 2012-13, 2013-14, 2014-15, 2015-16, 2016-17, 2017-18
  (6 seasons, 2,280 matches, 18 promoted teams).
- **Report:** 2018-19, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26
  (6 seasons, 2,280 matches, 18 promoted teams).
- **Excluded from both** (still used as training data): 2019-20 and 2020-21, COVID,
  as already recorded in the config.
- Chronological, so no tuned value could have been influenced by a report-season
  result through the data. 2012-13 is the earliest season where every strategy can
  run (the promoted prior needs one earlier season of promotions).

**Honest caveat.** The report seasons are not "never seen": the Phase 1 numbers
included them. What this protocol guarantees is narrower: nothing below is chosen
using them.

## Decisions, made on the tuning seasons only, in this order

**T1. Half-life and ridge sd, jointly.** Full grid:
half-life in {60, 90, 120, 180, 270, 365, 540} days x ridge sd in {0.5, 1.0, 2.0}.
Metric: log loss over every tuning-season match, `prior` strategy, weekly refits,
weight cutoff 0.001. **Rule: the lowest log loss wins.** No preference for the
current values (they were not chosen cleanly, so preferring them would carry the
old leak forward). Paired standard errors are reported for context only.

**T2. Weight cutoff.** Not a performance setting, so it is verified rather than
tuned: at the T1 winner, compare every tuning-season forecast with cutoff 0.001
against no cutoff. **Rule: keep 0.001 if no win/draw/loss probability moves by
0.001 or more; otherwise use 0.0001 and check again.**

**T3. Promoted-team strategy.** At the T1 settings, run `none`, `prior` and
`second_tier`. **Rule: lowest log loss on matches involving a promoted team**
(the only matches where the strategies meaningfully differ).

**T4. Season-simulation uncertainty.** At the T1 to T3 settings, season-level
backtest (4 checkpoints, 5,000 simulations each) with fixed strengths, with rating
uncertainty, and with rating uncertainty plus implied drift. **Rule: lowest pooled
zone log loss** (every zone, team and checkpoint).

## Reporting

With T1 to T4 fixed and written into the config, run once on the report
seasons:

- match level: log loss vs the base-rate baseline, calibration gap per outcome,
  per-season log loss, and paired promoted-team comparisons with 95% intervals;
- season level: Brier skill vs "knows nothing" and "the table as it stands" per
  zone and checkpoint, pooled calibration gap, confident (70-99%) forecasts.

Whatever comes out is reported, including if it is worse than the Phase 1
numbers. Nothing is re-tuned after seeing the report-season results. The old
settings are also scored on the report seasons, so the effect of re-tuning can
be separated from the effect of changing the seasons.
