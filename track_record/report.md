# Live track record (2026-11-02T08:14:54Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 198 (1 voided, 0 invalid); missed: 0; scored: 197; awaiting a result: 0

## all (197 scored)
- vs base rates: model better: -0.113 +/- 0.050 (n = 197; first half -0.113, second half -0.112)
- vs market: no detectable difference: +0.009 +/- 0.022 (n = 154; first half +0.014, second half +0.003)
  the interval is wide: roughly 185 matches are needed to detect a gap the size the backtest found

## bundesliga (36 scored)
- vs base rates: no detectable difference: -0.031 +/- 0.115 (n = 36; first half -0.032, second half -0.030)
  the interval is wide: roughly 75 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.049 (n = 27; first half -0.047, second half -0.022)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## la_liga (39 scored)
- vs base rates: model better: -0.158 +/- 0.105 (n = 39; first half -0.236, second half -0.083)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.042 +/- 0.043 (n = 30; first half +0.067, second half +0.017)
  the interval is wide: roughly 140 matches are needed to detect a gap the size the backtest found

## ligue_1 (35 scored)
- vs base rates: model better: -0.156 +/- 0.109 (n = 35; first half -0.204, second half -0.111)
  the interval is wide: roughly 66 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.012 +/- 0.053 (n = 27; first half -0.017, second half -0.006)
  the interval is wide: roughly 189 matches are needed to detect a gap the size the backtest found

## premier_league (39 scored)
- vs base rates: no detectable difference: -0.050 +/- 0.102 (n = 39; first half -0.092, second half -0.010)
  the interval is wide: roughly 64 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.044 +/- 0.043 (n = 30; first half +0.045, second half +0.044)
  the interval is wide: roughly 141 matches are needed to detect a gap the size the backtest found

## serie_a (48 scored)
- vs base rates: model better: -0.156 +/- 0.119 (n = 48; first half -0.086, second half -0.226)
  the interval is wide: roughly 106 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.000 +/- 0.050 (n = 40; first half +0.021, second half -0.022)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    17  0.15      0.12      0.03-0.34
home     20%-40%   72  0.31      0.38      0.27-0.49
home     40%-60%   72  0.50      0.57      0.45-0.68
home     60%-80%   33  0.67      0.76      0.59-0.87
home     80%-100%   3  0.83      1.00      0.44-1.00
draw     0%-20%    26  0.17      0.19      0.09-0.38
draw     20%-40%  171  0.25      0.21      0.16-0.28
away     0%-20%    46  0.14      0.09      0.03-0.20
away     20%-40%   95  0.30      0.20      0.13-0.29
away     40%-60%   47  0.49      0.60      0.45-0.72
away     60%-80%    9  0.69      0.78      0.45-0.94
