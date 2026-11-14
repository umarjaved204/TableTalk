# Live track record (2026-11-14T07:59:33Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 251 (1 voided, 0 invalid); missed: 0; scored: 250; awaiting a result: 0

## all (250 scored)
- vs base rates: model better: -0.121 +/- 0.044 (n = 250; first half -0.113, second half -0.128)
- vs market: no detectable difference: +0.015 +/- 0.016 (n = 250; first half +0.005, second half +0.024)

## bundesliga (45 scored)
- vs base rates: no detectable difference: -0.092 +/- 0.104 (n = 45; first half -0.000, second half -0.180)
  the interval is wide: roughly 77 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.026 +/- 0.035 (n = 45; first half -0.041, second half -0.012)
  the interval is wide: roughly 139 matches are needed to detect a gap the size the backtest found

## la_liga (50 scored)
- vs base rates: model better: -0.160 +/- 0.087 (n = 50; first half -0.188, second half -0.132)
  the interval is wide: roughly 60 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.052 +/- 0.034 (n = 50; first half +0.029, second half +0.076)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## ligue_1 (45 scored)
- vs base rates: model better: -0.153 +/- 0.094 (n = 45; first half -0.172, second half -0.135)
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
home     20%-40%   95  0.31      0.35      0.26-0.45
home     40%-60%   91  0.49      0.55      0.45-0.65
home     60%-80%   39  0.67      0.77      0.62-0.87
home     80%-100%   4  0.84      1.00      0.51-1.00
draw     0%-20%    32  0.17      0.16      0.07-0.32
draw     20%-40%  218  0.25      0.22      0.17-0.27
away     0%-20%    56  0.14      0.09      0.04-0.19
away     20%-40%  118  0.30      0.22      0.16-0.30
away     40%-60%   65  0.48      0.58      0.46-0.70
away     60%-80%   11  0.68      0.82      0.52-0.95
