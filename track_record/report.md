# Live track record (2026-10-28T07:22:27Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 148 (1 voided, 0 invalid); missed: 0; scored: 147; awaiting a result: 0

## all (147 scored)
- vs base rates: model better: -0.119 +/- 0.056 (n = 147; first half -0.110, second half -0.128)
- vs market: no detectable difference: +0.012 +/- 0.023 (n = 144; first half +0.017, second half +0.008)
  the interval is wide: roughly 187 matches are needed to detect a gap the size the backtest found

## bundesliga (27 scored)
- vs base rates: no detectable difference: -0.032 +/- 0.142 (n = 27; first half -0.027, second half -0.036)
  the interval is wide: roughly 86 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.049 (n = 27; first half -0.047, second half -0.022)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## la_liga (30 scored)
- vs base rates: model better: -0.159 +/- 0.097 (n = 30; first half -0.210, second half -0.107)
  the interval is wide: roughly 44 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.042 +/- 0.043 (n = 30; first half +0.067, second half +0.017)
  the interval is wide: roughly 140 matches are needed to detect a gap the size the backtest found

## ligue_1 (27 scored)
- vs base rates: model better: -0.163 +/- 0.122 (n = 27; first half -0.240, second half -0.092)
  the interval is wide: roughly 63 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.012 +/- 0.053 (n = 27; first half -0.017, second half -0.006)
  the interval is wide: roughly 189 matches are needed to detect a gap the size the backtest found

## premier_league (30 scored)
- vs base rates: no detectable difference: -0.074 +/- 0.122 (n = 30; first half -0.055, second half -0.093)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.044 +/- 0.043 (n = 30; first half +0.045, second half +0.044)
  the interval is wide: roughly 141 matches are needed to detect a gap the size the backtest found

## serie_a (33 scored)
- vs base rates: model better: -0.160 +/- 0.138 (n = 33; first half -0.097, second half -0.220)
  the interval is wide: roughly 99 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.013 +/- 0.061 (n = 30; first half +0.011, second half +0.016)
  the interval is wide: roughly 279 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    12  0.17      0.17      0.05-0.45
home     20%-40%   54  0.31      0.30      0.19-0.43
home     40%-60%   52  0.50      0.56      0.42-0.68
home     60%-80%   27  0.67      0.78      0.59-0.89
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    19  0.17      0.21      0.09-0.43
draw     20%-40%  128  0.25      0.23      0.17-0.31
away     0%-20%    36  0.14      0.06      0.02-0.18
away     20%-40%   67  0.30      0.22      0.14-0.34
away     40%-60%   39  0.49      0.59      0.43-0.73
away     60%-80%    5  0.67      0.60      0.23-0.88
