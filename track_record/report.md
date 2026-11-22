# Live track record (2026-11-22T08:47:58Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 280 (1 voided, 0 invalid); missed: 0; scored: 279; awaiting a result: 0

## all (279 scored)
- vs base rates: model better: -0.117 +/- 0.042 (n = 279; first half -0.110, second half -0.125)
- vs market: no detectable difference: +0.015 +/- 0.016 (n = 250; first half +0.005, second half +0.024)

## bundesliga (52 scored)
- vs base rates: no detectable difference: -0.095 +/- 0.107 (n = 52; first half -0.003, second half -0.187)
  the interval is wide: roughly 93 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.026 +/- 0.035 (n = 45; first half -0.041, second half -0.012)
  the interval is wide: roughly 139 matches are needed to detect a gap the size the backtest found

## la_liga (55 scored)
- vs base rates: model better: -0.147 +/- 0.082 (n = 55; first half -0.176, second half -0.119)
  the interval is wide: roughly 59 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.052 +/- 0.034 (n = 50; first half +0.029, second half +0.076)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## ligue_1 (51 scored)
- vs base rates: model better: -0.137 +/- 0.089 (n = 51; first half -0.160, second half -0.115)
  the interval is wide: roughly 63 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.006 +/- 0.038 (n = 45; first half -0.030, second half +0.040)
  the interval is wide: roughly 162 matches are needed to detect a gap the size the backtest found

## premier_league (57 scored)
- vs base rates: no detectable difference: -0.036 +/- 0.086 (n = 57; first half -0.063, second half -0.010)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.036 +/- 0.032 (n = 50; first half +0.054, second half +0.018)
  the interval is wide: roughly 130 matches are needed to detect a gap the size the backtest found

## serie_a (64 scored)
- vs base rates: model better: -0.166 +/- 0.100 (n = 64; first half -0.152, second half -0.180)
  the interval is wide: roughly 101 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.002 +/- 0.037 (n = 60; first half +0.013, second half -0.008)
  the interval is wide: roughly 202 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    24  0.16      0.12      0.04-0.31
home     20%-40%  102  0.31      0.34      0.26-0.44
home     40%-60%  101  0.49      0.52      0.43-0.62
home     60%-80%   47  0.67      0.77      0.63-0.86
home     80%-100%   5  0.85      0.80      0.38-0.96
draw     0%-20%    35  0.16      0.17      0.08-0.33
draw     20%-40%  244  0.25      0.22      0.17-0.28
away     0%-20%    65  0.14      0.08      0.03-0.17
away     20%-40%  132  0.30      0.24      0.18-0.32
away     40%-60%   70  0.49      0.59      0.47-0.69
away     60%-80%   12  0.68      0.83      0.55-0.95
