# Live track record (2026-11-09T08:39:14Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 251 (1 voided, 0 invalid); missed: 0; scored: 250; awaiting a result: 0

## all (250 scored)
- vs base rates: model better: -0.121 +/- 0.044 (n = 250; first half -0.113, second half -0.128)
- vs market: no detectable difference: +0.009 +/- 0.018 (n = 202; first half +0.008, second half +0.010)

## bundesliga (45 scored)
- vs base rates: no detectable difference: -0.092 +/- 0.104 (n = 45; first half -0.000, second half -0.180)
  the interval is wide: roughly 77 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.036 +/- 0.041 (n = 36; first half -0.031, second half -0.042)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## la_liga (50 scored)
- vs base rates: model better: -0.160 +/- 0.087 (n = 50; first half -0.188, second half -0.132)
  the interval is wide: roughly 60 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.037 +/- 0.039 (n = 40; first half +0.029, second half +0.045)
  the interval is wide: roughly 151 matches are needed to detect a gap the size the backtest found

## ligue_1 (45 scored)
- vs base rates: model better: -0.153 +/- 0.094 (n = 45; first half -0.172, second half -0.135)
  the interval is wide: roughly 63 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.008 +/- 0.041 (n = 36; first half -0.033, second half +0.016)
  the interval is wide: roughly 155 matches are needed to detect a gap the size the backtest found

## premier_league (50 scored)
- vs base rates: no detectable difference: -0.046 +/- 0.096 (n = 50; first half -0.069, second half -0.024)
  the interval is wide: roughly 73 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.043 +/- 0.036 (n = 40; first half +0.057, second half +0.029)
  the interval is wide: roughly 129 matches are needed to detect a gap the size the backtest found

## serie_a (60 scored)
- vs base rates: model better: -0.147 +/- 0.105 (n = 60; first half -0.129, second half -0.165)
  the interval is wide: roughly 104 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.005 +/- 0.041 (n = 50; first half +0.011, second half -0.000)
  the interval is wide: roughly 210 matches are needed to detect a gap the size the backtest found

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
