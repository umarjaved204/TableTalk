# Live track record (2026-11-23T09:44:29Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 296 (1 voided, 0 invalid); missed: 0; scored: 295; awaiting a result: 0

## all (295 scored)
- vs base rates: model better: -0.112 +/- 0.041 (n = 295; first half -0.119, second half -0.105)
- vs market: no detectable difference: +0.015 +/- 0.016 (n = 250; first half +0.005, second half +0.024)

## bundesliga (54 scored)
- vs base rates: no detectable difference: -0.091 +/- 0.103 (n = 54; first half -0.032, second half -0.151)
  the interval is wide: roughly 90 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.026 +/- 0.035 (n = 45; first half -0.041, second half -0.012)
  the interval is wide: roughly 139 matches are needed to detect a gap the size the backtest found

## la_liga (59 scored)
- vs base rates: model better: -0.149 +/- 0.081 (n = 59; first half -0.163, second half -0.136)
  the interval is wide: roughly 62 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.052 +/- 0.034 (n = 50; first half +0.029, second half +0.076)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## ligue_1 (54 scored)
- vs base rates: model better: -0.118 +/- 0.093 (n = 54; first half -0.163, second half -0.073)
  the interval is wide: roughly 74 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.006 +/- 0.038 (n = 45; first half -0.030, second half +0.040)
  the interval is wide: roughly 162 matches are needed to detect a gap the size the backtest found

## premier_league (59 scored)
- vs base rates: no detectable difference: -0.027 +/- 0.087 (n = 59; first half -0.069, second half +0.013)
  the interval is wide: roughly 70 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.036 +/- 0.032 (n = 50; first half +0.054, second half +0.018)
  the interval is wide: roughly 130 matches are needed to detect a gap the size the backtest found

## serie_a (69 scored)
- vs base rates: model better: -0.165 +/- 0.094 (n = 69; first half -0.160, second half -0.170)
  the interval is wide: roughly 96 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.002 +/- 0.037 (n = 60; first half +0.013, second half -0.008)
  the interval is wide: roughly 202 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    24  0.16      0.12      0.04-0.31
home     20%-40%  109  0.31      0.35      0.27-0.44
home     40%-60%  105  0.50      0.53      0.44-0.63
home     60%-80%   52  0.67      0.77      0.64-0.86
home     80%-100%   5  0.85      0.80      0.38-0.96
draw     0%-20%    37  0.16      0.16      0.08-0.31
draw     20%-40%  258  0.25      0.22      0.17-0.28
away     0%-20%    71  0.14      0.08      0.04-0.17
away     20%-40%  138  0.30      0.24      0.18-0.32
away     40%-60%   74  0.49      0.57      0.45-0.67
away     60%-80%   12  0.68      0.83      0.55-0.95
