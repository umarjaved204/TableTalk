# Live track record (2026-10-25T08:40:59Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 110 (1 voided, 0 invalid); missed: 0; scored: 105; awaiting a result: 4

## all (105 scored)
- vs base rates: model better: -0.103 +/- 0.071 (n = 105; first half -0.101, second half -0.105)
- vs market: no detectable difference: +0.010 +/- 0.031 (n = 96; first half +0.002, second half +0.019)
  the interval is wide: roughly 225 matches are needed to detect a gap the size the backtest found

## bundesliga (19 scored)
- vs base rates: no detectable difference: +0.004 +/- 0.167 (n = 19; first half +0.019, second half -0.009)
  the interval is wide: roughly 83 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.031 +/- 0.068 (n = 18; first half -0.034, second half -0.028)
  the interval is wide: roughly 207 matches are needed to detect a gap the size the backtest found

## la_liga (21 scored)
- vs base rates: model better: -0.199 +/- 0.116 (n = 21; first half -0.188, second half -0.210)
  the interval is wide: roughly 44 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.029 +/- 0.053 (n = 20; first half +0.083, second half -0.026)
  the interval is wide: roughly 143 matches are needed to detect a gap the size the backtest found

## ligue_1 (19 scored)
- vs base rates: model better: -0.197 +/- 0.161 (n = 19; first half -0.163, second half -0.227)
  the interval is wide: roughly 77 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.033 +/- 0.070 (n = 18; first half -0.040, second half -0.025)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

## premier_league (25 scored)
- vs base rates: no detectable difference: -0.069 +/- 0.145 (n = 25; first half +0.006, second half -0.139)
  the interval is wide: roughly 83 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.057 +/- 0.057 (n = 20; first half +0.057, second half +0.058)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## serie_a (21 scored)
- vs base rates: no detectable difference: -0.058 +/- 0.191 (n = 21; first half -0.191, second half +0.063)
  the interval is wide: roughly 120 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.021 +/- 0.087 (n = 20; first half -0.047, second half +0.090)
  the interval is wide: roughly 376 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    10  0.17      0.20      0.06-0.51
home     20%-40%   42  0.31      0.33      0.21-0.48
home     40%-60%   34  0.50      0.59      0.42-0.74
home     60%-80%   17  0.68      0.76      0.53-0.90
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    12  0.16      0.25      0.09-0.53
draw     20%-40%   93  0.25      0.22      0.14-0.31
away     0%-20%    25  0.14      0.08      0.02-0.25
away     20%-40%   47  0.30      0.21      0.12-0.35
away     40%-60%   29  0.49      0.59      0.41-0.74
away     60%-80%    4  0.66      0.50      0.15-0.85
