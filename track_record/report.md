# Live track record (2026-10-16T06:20:14Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 48 (1 voided, 0 invalid); missed: 0; scored: 44; awaiting a result: 3

## all (44 scored)
- vs base rates: no detectable difference: -0.091 +/- 0.101 (n = 44; first half -0.083, second half -0.099)
  the interval is wide: roughly 70 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.001 +/- 0.041 (n = 44; first half -0.010, second half +0.012)
  the interval is wide: roughly 184 matches are needed to detect a gap the size the backtest found

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

## ligue_1 (6 scored)
- vs base rates: no detectable difference: -0.116 +/- 0.264 (n = 6; first half -0.164, second half -0.068)
  the interval is wide: roughly 66 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.079 +/- 0.094 (n = 6; first half -0.059, second half -0.098)
  the interval is wide: roughly 133 matches are needed to detect a gap the size the backtest found

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
home     0%-20%     3  0.16      0.33      0.06-0.79
home     20%-40%   18  0.31      0.33      0.16-0.56
home     40%-60%   13  0.51      0.62      0.36-0.82
home     60%-80%    9  0.69      0.89      0.56-0.98
home     80%-100%   1  0.83      1.00      0.21-1.00
draw     0%-20%     7  0.16      0.29      0.08-0.64
draw     20%-40%   37  0.26      0.30      0.17-0.46
away     0%-20%    13  0.13      0.08      0.01-0.33
away     20%-40%   19  0.31      0.00      0.00-0.17
away     40%-60%   11  0.48      0.55      0.28-0.79
away     60%-80%    1  0.74      0.00      0.00-0.79
