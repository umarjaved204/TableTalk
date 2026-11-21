# Live track record (2026-11-21T08:45:19Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 254 (1 voided, 0 invalid); missed: 0; scored: 253; awaiting a result: 0

## all (253 scored)
- vs base rates: model better: -0.113 +/- 0.045 (n = 253; first half -0.111, second half -0.114)
- vs market: no detectable difference: +0.015 +/- 0.016 (n = 250; first half +0.005, second half +0.024)

## bundesliga (46 scored)
- vs base rates: no detectable difference: -0.064 +/- 0.115 (n = 46; first half -0.017, second half -0.112)
  the interval is wide: roughly 96 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.026 +/- 0.035 (n = 45; first half -0.041, second half -0.012)
  the interval is wide: roughly 139 matches are needed to detect a gap the size the backtest found

## la_liga (51 scored)
- vs base rates: model better: -0.150 +/- 0.087 (n = 51; first half -0.188, second half -0.114)
  the interval is wide: roughly 61 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.052 +/- 0.034 (n = 50; first half +0.029, second half +0.076)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## ligue_1 (46 scored)
- vs base rates: model better: -0.147 +/- 0.093 (n = 46; first half -0.153, second half -0.140)
  the interval is wide: roughly 63 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.006 +/- 0.038 (n = 45; first half -0.030, second half +0.040)
  the interval is wide: roughly 162 matches are needed to detect a gap the size the backtest found

## premier_league (50 scored)
- vs base rates: no detectable difference: -0.046 +/- 0.096 (n = 50; first half -0.069, second half -0.024)
  the interval is wide: roughly 73 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.036 +/- 0.032 (n = 50; first half +0.054, second half +0.018)
  the interval is wide: roughly 130 matches are needed to detect a gap the size the backtest found

## serie_a (60 scored)
- vs base rates: model better: -0.147 +/- 0.105 (n = 60; first half -0.129, second half -0.165)
  the interval is wide: roughly 104 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.002 +/- 0.037 (n = 60; first half +0.013, second half -0.008)
  the interval is wide: roughly 202 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    21  0.16      0.14      0.05-0.35
home     20%-40%   96  0.31      0.35      0.27-0.45
home     40%-60%   92  0.49      0.54      0.44-0.64
home     60%-80%   39  0.67      0.77      0.62-0.87
home     80%-100%   5  0.85      0.80      0.38-0.96
draw     0%-20%    33  0.16      0.18      0.09-0.34
draw     20%-40%  220  0.26      0.21      0.16-0.27
away     0%-20%    57  0.14      0.09      0.04-0.19
away     20%-40%  120  0.30      0.23      0.16-0.31
away     40%-60%   65  0.48      0.58      0.46-0.70
away     60%-80%   11  0.68      0.82      0.52-0.95
