# Live track record (2026-11-01T08:07:09Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 182 (1 voided, 0 invalid); missed: 0; scored: 181; awaiting a result: 0

## all (181 scored)
- vs base rates: model better: -0.106 +/- 0.053 (n = 181; first half -0.122, second half -0.091)
- vs market: no detectable difference: +0.009 +/- 0.022 (n = 154; first half +0.014, second half +0.003)
  the interval is wide: roughly 185 matches are needed to detect a gap the size the backtest found

## bundesliga (34 scored)
- vs base rates: no detectable difference: -0.022 +/- 0.121 (n = 34; first half -0.024, second half -0.019)
  the interval is wide: roughly 78 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.049 (n = 27; first half -0.047, second half -0.022)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## la_liga (35 scored)
- vs base rates: model better: -0.157 +/- 0.103 (n = 35; first half -0.216, second half -0.101)
  the interval is wide: roughly 59 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.042 +/- 0.043 (n = 30; first half +0.067, second half +0.017)
  the interval is wide: roughly 140 matches are needed to detect a gap the size the backtest found

## ligue_1 (31 scored)
- vs base rates: model better: -0.154 +/- 0.121 (n = 31; first half -0.260, second half -0.055)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.012 +/- 0.053 (n = 27; first half -0.017, second half -0.006)
  the interval is wide: roughly 189 matches are needed to detect a gap the size the backtest found

## premier_league (38 scored)
- vs base rates: no detectable difference: -0.043 +/- 0.104 (n = 38; first half -0.092, second half +0.006)
  the interval is wide: roughly 65 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.044 +/- 0.043 (n = 30; first half +0.045, second half +0.044)
  the interval is wide: roughly 141 matches are needed to detect a gap the size the backtest found

## serie_a (43 scored)
- vs base rates: model better: -0.154 +/- 0.130 (n = 43; first half -0.058, second half -0.246)
  the interval is wide: roughly 115 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.000 +/- 0.050 (n = 40; first half +0.021, second half -0.022)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    16  0.16      0.12      0.03-0.36
home     20%-40%   67  0.31      0.36      0.25-0.48
home     40%-60%   64  0.49      0.55      0.43-0.66
home     60%-80%   31  0.67      0.74      0.57-0.86
home     80%-100%   3  0.83      1.00      0.44-1.00
draw     0%-20%    24  0.17      0.21      0.09-0.40
draw     20%-40%  157  0.25      0.22      0.16-0.29
away     0%-20%    42  0.14      0.10      0.04-0.22
away     20%-40%   86  0.30      0.21      0.14-0.31
away     40%-60%   45  0.49      0.58      0.43-0.71
away     60%-80%    8  0.68      0.75      0.41-0.93
