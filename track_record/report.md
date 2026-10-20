# Live track record (2026-10-20T08:50:09Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 96 (1 voided, 0 invalid); missed: 0; scored: 95; awaiting a result: 0

## all (95 scored)
- vs base rates: model better: -0.124 +/- 0.073 (n = 95; first half -0.102, second half -0.146)
- vs market: no detectable difference: +0.003 +/- 0.042 (n = 47; first half -0.019, second half +0.024)
  the interval is wide: roughly 205 matches are needed to detect a gap the size the backtest found

## bundesliga (18 scored)
- vs base rates: no detectable difference: -0.032 +/- 0.160 (n = 18; first half +0.019, second half -0.082)
  the interval is wide: roughly 72 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.120 (n = 9; first half +0.029, second half -0.085)
  the interval is wide: roughly 325 matches are needed to detect a gap the size the backtest found

## la_liga (19 scored)
- vs base rates: model better: -0.236 +/- 0.115 (n = 19; first half -0.213, second half -0.258)
  the interval is wide: roughly 40 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.079 +/- 0.040 (n = 9; first half +0.072, second half +0.084)
  the interval is wide: roughly 36 matches are needed to detect a gap the size the backtest found

## ligue_1 (18 scored)
- vs base rates: model better: -0.206 +/- 0.169 (n = 18; first half -0.163, second half -0.249)
  the interval is wide: roughly 81 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.040 +/- 0.115 (n = 9; first half -0.114, second half +0.019)
  the interval is wide: roughly 299 matches are needed to detect a gap the size the backtest found

## premier_league (20 scored)
- vs base rates: no detectable difference: -0.098 +/- 0.155 (n = 20; first half +0.034, second half -0.230)
  the interval is wide: roughly 76 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.057 +/- 0.100 (n = 10; first half +0.079, second half +0.036)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## serie_a (20 scored)
- vs base rates: no detectable difference: -0.054 +/- 0.200 (n = 20; first half -0.191, second half +0.084)
  the interval is wide: roughly 126 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.047 +/- 0.052 (n = 10; first half -0.047, second half -0.048)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    10  0.17      0.20      0.06-0.51
home     20%-40%   38  0.31      0.32      0.19-0.47
home     40%-60%   31  0.50      0.61      0.44-0.76
home     60%-80%   14  0.69      0.86      0.60-0.96
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    11  0.16      0.27      0.10-0.57
draw     20%-40%   84  0.25      0.21      0.14-0.31
away     0%-20%    22  0.14      0.05      0.01-0.22
away     20%-40%   43  0.30      0.19      0.10-0.33
away     40%-60%   26  0.49      0.62      0.43-0.78
away     60%-80%    4  0.66      0.50      0.15-0.85
