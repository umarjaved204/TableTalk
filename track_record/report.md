# Live track record (2026-10-17T06:08:53Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 51 (1 voided, 0 invalid); missed: 0; scored: 43; awaiting a result: 7

## all (43 scored)
- vs base rates: no detectable difference: -0.095 +/- 0.104 (n = 43; first half -0.067, second half -0.122)
  the interval is wide: roughly 74 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.013 +/- 0.047 (n = 40; first half -0.008, second half +0.033)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

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

## premier_league (10 scored)
- vs base rates: no detectable difference: +0.034 +/- 0.262 (n = 10; first half -0.031, second half +0.100)
  the interval is wide: roughly 108 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.057 +/- 0.100 (n = 10; first half +0.079, second half +0.036)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## serie_a (3 scored)
- vs base rates: no detectable difference: -0.229 +/- 0.527 (n = 3; first half +0.301, second half -0.494)
  the interval is wide: roughly 130 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.032 +/- 0.081 (n = 3; first half -0.074, second half -0.011)
  the interval is wide: roughly 50 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%     3  0.16      0.33      0.06-0.79
home     20%-40%   16  0.32      0.38      0.18-0.61
home     40%-60%   16  0.51      0.62      0.39-0.82
home     60%-80%    7  0.69      0.86      0.49-0.97
home     80%-100%   1  0.83      1.00      0.21-1.00
draw     0%-20%     6  0.16      0.33      0.10-0.70
draw     20%-40%   37  0.25      0.24      0.13-0.40
away     0%-20%    11  0.13      0.09      0.02-0.38
away     20%-40%   21  0.30      0.00      0.00-0.15
away     40%-60%    9  0.46      0.67      0.35-0.88
away     60%-80%    2  0.68      0.50      0.09-0.91
