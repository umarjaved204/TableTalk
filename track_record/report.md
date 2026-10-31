# Live track record (2026-10-31T07:29:16Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 160 (1 voided, 0 invalid); missed: 0; scored: 159; awaiting a result: 0

## all (159 scored)
- vs base rates: model better: -0.113 +/- 0.057 (n = 159; first half -0.123, second half -0.104)
- vs market: no detectable difference: +0.009 +/- 0.022 (n = 154; first half +0.014, second half +0.003)
  the interval is wide: roughly 185 matches are needed to detect a gap the size the backtest found

## bundesliga (28 scored)
- vs base rates: no detectable difference: -0.021 +/- 0.139 (n = 28; first half -0.020, second half -0.021)
  the interval is wide: roughly 85 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.049 (n = 27; first half -0.047, second half -0.022)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## la_liga (31 scored)
- vs base rates: model better: -0.133 +/- 0.106 (n = 31; first half -0.210, second half -0.061)
  the interval is wide: roughly 55 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.042 +/- 0.043 (n = 30; first half +0.067, second half +0.017)
  the interval is wide: roughly 140 matches are needed to detect a gap the size the backtest found

## ligue_1 (30 scored)
- vs base rates: model better: -0.165 +/- 0.123 (n = 30; first half -0.260, second half -0.071)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.012 +/- 0.053 (n = 27; first half -0.017, second half -0.006)
  the interval is wide: roughly 189 matches are needed to detect a gap the size the backtest found

## premier_league (30 scored)
- vs base rates: no detectable difference: -0.074 +/- 0.122 (n = 30; first half -0.055, second half -0.093)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.044 +/- 0.043 (n = 30; first half +0.045, second half +0.044)
  the interval is wide: roughly 141 matches are needed to detect a gap the size the backtest found

## serie_a (40 scored)
- vs base rates: model better: -0.154 +/- 0.134 (n = 40; first half -0.054, second half -0.254)
  the interval is wide: roughly 112 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.000 +/- 0.050 (n = 40; first half +0.021, second half -0.022)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    15  0.16      0.13      0.04-0.38
home     20%-40%   59  0.31      0.32      0.22-0.45
home     40%-60%   55  0.49      0.56      0.43-0.69
home     60%-80%   28  0.67      0.75      0.57-0.87
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    21  0.17      0.19      0.08-0.40
draw     20%-40%  138  0.25      0.23      0.17-0.31
away     0%-20%    37  0.14      0.08      0.03-0.21
away     20%-40%   73  0.30      0.22      0.14-0.33
away     40%-60%   41  0.49      0.56      0.41-0.70
away     60%-80%    8  0.68      0.75      0.41-0.93
