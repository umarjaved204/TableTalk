# Live track record (2026-10-17T08:00:11Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 52 (1 voided, 0 invalid); missed: 0; scored: 47; awaiting a result: 4

## all (47 scored)
- vs base rates: model better: -0.118 +/- 0.090 (n = 47; first half -0.106, second half -0.129)
  the interval is wide: roughly 61 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.002 +/- 0.042 (n = 43; first half -0.011, second half +0.006)
  the interval is wide: roughly 188 matches are needed to detect a gap the size the backtest found

## bundesliga (10 scored)
- vs base rates: no detectable difference: -0.007 +/- 0.222 (n = 10; first half +0.023, second half -0.036)
  the interval is wide: roughly 78 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.120 (n = 9; first half +0.029, second half -0.085)
  the interval is wide: roughly 325 matches are needed to detect a gap the size the backtest found

## la_liga (10 scored)
- vs base rates: model better: -0.188 +/- 0.130 (n = 10; first half -0.298, second half -0.078)
  the interval is wide: roughly 27 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.079 +/- 0.040 (n = 9; first half +0.072, second half +0.084)
  the interval is wide: roughly 36 matches are needed to detect a gap the size the backtest found

## ligue_1 (10 scored)
- vs base rates: no detectable difference: -0.181 +/- 0.213 (n = 10; first half -0.170, second half -0.192)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.040 +/- 0.115 (n = 9; first half -0.114, second half +0.019)
  the interval is wide: roughly 299 matches are needed to detect a gap the size the backtest found

## premier_league (6 scored)
- vs base rates: no detectable difference: -0.024 +/- 0.283 (n = 6; first half -0.233, second half +0.185)
  the interval is wide: roughly 76 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.056 +/- 0.105 (n = 6; first half +0.033, second half +0.078)
  the interval is wide: roughly 166 matches are needed to detect a gap the size the backtest found

## serie_a (11 scored)
- vs base rates: no detectable difference: -0.149 +/- 0.195 (n = 11; first half -0.246, second half -0.068)
  the interval is wide: roughly 66 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.047 +/- 0.052 (n = 10; first half -0.047, second half -0.048)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%     3  0.16      0.00      0.00-0.56
home     20%-40%   18  0.32      0.39      0.20-0.61
home     40%-60%   16  0.51      0.62      0.39-0.82
home     60%-80%    9  0.69      0.89      0.56-0.98
home     80%-100%   1  0.83      1.00      0.21-1.00
draw     0%-20%     7  0.16      0.29      0.08-0.64
draw     20%-40%   40  0.25      0.28      0.16-0.43
away     0%-20%    13  0.13      0.08      0.01-0.33
away     20%-40%   21  0.30      0.00      0.00-0.15
away     40%-60%   11  0.47      0.55      0.28-0.79
away     60%-80%    2  0.68      0.50      0.09-0.91
