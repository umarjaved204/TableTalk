# Live track record (2026-11-03T08:32:48Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 203 (1 voided, 0 invalid); missed: 0; scored: 202; awaiting a result: 0

## all (202 scored)
- vs base rates: model better: -0.106 +/- 0.050 (n = 202; first half -0.110, second half -0.102)
- vs market: no detectable difference: +0.008 +/- 0.018 (n = 197; first half +0.007, second half +0.010)

## bundesliga (36 scored)
- vs base rates: no detectable difference: -0.031 +/- 0.115 (n = 36; first half -0.032, second half -0.030)
  the interval is wide: roughly 75 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.036 +/- 0.041 (n = 36; first half -0.031, second half -0.042)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## la_liga (40 scored)
- vs base rates: model better: -0.151 +/- 0.103 (n = 40; first half -0.213, second half -0.089)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.035 +/- 0.040 (n = 39; first half +0.042, second half +0.028)
  the interval is wide: roughly 154 matches are needed to detect a gap the size the backtest found

## ligue_1 (36 scored)
- vs base rates: model better: -0.153 +/- 0.106 (n = 36; first half -0.206, second half -0.100)
  the interval is wide: roughly 64 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.009 +/- 0.043 (n = 35; first half -0.024, second half +0.005)
  the interval is wide: roughly 159 matches are needed to detect a gap the size the backtest found

## premier_league (40 scored)
- vs base rates: no detectable difference: -0.044 +/- 0.101 (n = 40; first half -0.098, second half +0.010)
  the interval is wide: roughly 64 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.041 +/- 0.036 (n = 39; first half +0.054, second half +0.029)
  the interval is wide: roughly 130 matches are needed to detect a gap the size the backtest found

## serie_a (50 scored)
- vs base rates: model better: -0.140 +/- 0.120 (n = 50; first half -0.094, second half -0.185)
  the interval is wide: roughly 113 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.006 +/- 0.042 (n = 48; first half +0.006, second half +0.007)
  the interval is wide: roughly 217 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    17  0.15      0.12      0.03-0.34
home     20%-40%   73  0.31      0.37      0.27-0.48
home     40%-60%   75  0.49      0.56      0.45-0.67
home     60%-80%   34  0.67      0.74      0.57-0.85
home     80%-100%   3  0.83      1.00      0.44-1.00
draw     0%-20%    26  0.17      0.19      0.09-0.38
draw     20%-40%  176  0.25      0.20      0.15-0.27
away     0%-20%    47  0.14      0.11      0.05-0.23
away     20%-40%   98  0.30      0.21      0.14-0.31
away     40%-60%   48  0.49      0.60      0.46-0.73
away     60%-80%    9  0.69      0.78      0.45-0.94
