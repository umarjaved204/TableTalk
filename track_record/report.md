# Live track record (2026-10-19T06:46:44Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 92 (1 voided, 0 invalid); missed: 0; scored: 91; awaiting a result: 0

## all (91 scored)
- vs base rates: model better: -0.126 +/- 0.076 (n = 91; first half -0.126, second half -0.125)
- vs market: no detectable difference: +0.003 +/- 0.042 (n = 47; first half -0.019, second half +0.024)
  the interval is wide: roughly 205 matches are needed to detect a gap the size the backtest found

## bundesliga (18 scored)
- vs base rates: no detectable difference: -0.032 +/- 0.160 (n = 18; first half +0.019, second half -0.082)
  the interval is wide: roughly 72 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.120 (n = 9; first half +0.029, second half -0.085)
  the interval is wide: roughly 325 matches are needed to detect a gap the size the backtest found

## la_liga (18 scored)
- vs base rates: model better: -0.231 +/- 0.121 (n = 18; first half -0.213, second half -0.249)
  the interval is wide: roughly 41 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.079 +/- 0.040 (n = 9; first half +0.072, second half +0.084)
  the interval is wide: roughly 36 matches are needed to detect a gap the size the backtest found

## ligue_1 (18 scored)
- vs base rates: model better: -0.206 +/- 0.169 (n = 18; first half -0.163, second half -0.249)
  the interval is wide: roughly 81 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.040 +/- 0.115 (n = 9; first half -0.114, second half +0.019)
  the interval is wide: roughly 299 matches are needed to detect a gap the size the backtest found

## premier_league (19 scored)
- vs base rates: no detectable difference: -0.092 +/- 0.163 (n = 19; first half -0.059, second half -0.122)
  the interval is wide: roughly 79 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.057 +/- 0.100 (n = 10; first half +0.079, second half +0.036)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## serie_a (18 scored)
- vs base rates: no detectable difference: -0.069 +/- 0.218 (n = 18; first half -0.228, second half +0.090)
  the interval is wide: roughly 134 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.047 +/- 0.052 (n = 10; first half -0.047, second half -0.048)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    10  0.17      0.20      0.06-0.51
home     20%-40%   35  0.31      0.31      0.19-0.48
home     40%-60%   30  0.50      0.60      0.42-0.75
home     60%-80%   14  0.69      0.86      0.60-0.96
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    11  0.16      0.27      0.10-0.57
draw     20%-40%   80  0.25      0.21      0.14-0.31
away     0%-20%    22  0.14      0.05      0.01-0.22
away     20%-40%   40  0.31      0.17      0.09-0.32
away     40%-60%   25  0.49      0.64      0.45-0.80
away     60%-80%    4  0.66      0.50      0.15-0.85
