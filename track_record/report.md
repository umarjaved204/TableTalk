# Live track record (2026-10-13T08:25:00Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 48 (1 voided, 0 invalid); missed: 0; scored: 47; awaiting a result: 0

## all (47 scored)
- vs base rates: model better: -0.102 +/- 0.099 (n = 47; first half -0.090, second half -0.113)
  the interval is wide: roughly 72 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.003 +/- 0.042 (n = 47; first half -0.019, second half +0.024)
  the interval is wide: roughly 205 matches are needed to detect a gap the size the backtest found

## bundesliga (9 scored)
- vs base rates: no detectable difference: +0.019 +/- 0.243 (n = 9; first half -0.098, second half +0.112)
  the interval is wide: roughly 83 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.120 (n = 9; first half +0.029, second half -0.085)
  the interval is wide: roughly 325 matches are needed to detect a gap the size the backtest found

## la_liga (9 scored)
- vs base rates: model better: -0.213 +/- 0.135 (n = 9; first half -0.372, second half -0.085)
  the interval is wide: roughly 26 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.079 +/- 0.040 (n = 9; first half +0.072, second half +0.084)
  the interval is wide: roughly 36 matches are needed to detect a gap the size the backtest found

## ligue_1 (9 scored)
- vs base rates: no detectable difference: -0.163 +/- 0.234 (n = 9; first half -0.057, second half -0.248)
  the interval is wide: roughly 78 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.040 +/- 0.115 (n = 9; first half -0.114, second half +0.019)
  the interval is wide: roughly 299 matches are needed to detect a gap the size the backtest found

## premier_league (10 scored)
- vs base rates: no detectable difference: +0.034 +/- 0.262 (n = 10; first half -0.031, second half +0.100)
  the interval is wide: roughly 108 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.057 +/- 0.100 (n = 10; first half +0.079, second half +0.036)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## serie_a (10 scored)
- vs base rates: no detectable difference: -0.191 +/- 0.195 (n = 10; first half -0.246, second half -0.137)
  the interval is wide: roughly 60 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.047 +/- 0.052 (n = 10; first half -0.047, second half -0.048)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%     4  0.17      0.25      0.05-0.70
home     20%-40%   19  0.31      0.37      0.19-0.59
home     40%-60%   14  0.52      0.64      0.39-0.84
home     60%-80%    9  0.69      0.89      0.56-0.98
home     80%-100%   1  0.83      1.00      0.21-1.00
draw     0%-20%     7  0.16      0.29      0.08-0.64
draw     20%-40%   40  0.25      0.28      0.16-0.43
away     0%-20%    13  0.13      0.08      0.01-0.33
away     20%-40%   21  0.31      0.00      0.00-0.15
away     40%-60%   11  0.48      0.55      0.28-0.79
away     60%-80%    2  0.68      0.50      0.09-0.91
