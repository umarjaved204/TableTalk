# Live track record (2026-10-22T06:34:02Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 97 (1 voided, 0 invalid); missed: 0; scored: 96; awaiting a result: 0

## all (96 scored)
- vs base rates: model better: -0.120 +/- 0.073 (n = 96; first half -0.104, second half -0.136)
- vs market: no detectable difference: +0.010 +/- 0.031 (n = 96; first half +0.002, second half +0.019)
  the interval is wide: roughly 225 matches are needed to detect a gap the size the backtest found

## bundesliga (18 scored)
- vs base rates: no detectable difference: -0.032 +/- 0.160 (n = 18; first half +0.019, second half -0.082)
  the interval is wide: roughly 72 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.031 +/- 0.068 (n = 18; first half -0.034, second half -0.028)
  the interval is wide: roughly 207 matches are needed to detect a gap the size the backtest found

## la_liga (20 scored)
- vs base rates: model better: -0.213 +/- 0.118 (n = 20; first half -0.188, second half -0.238)
  the interval is wide: roughly 44 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.029 +/- 0.053 (n = 20; first half +0.083, second half -0.026)
  the interval is wide: roughly 143 matches are needed to detect a gap the size the backtest found

## ligue_1 (18 scored)
- vs base rates: model better: -0.206 +/- 0.169 (n = 18; first half -0.163, second half -0.249)
  the interval is wide: roughly 81 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.033 +/- 0.070 (n = 18; first half -0.040, second half -0.025)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

## premier_league (20 scored)
- vs base rates: no detectable difference: -0.098 +/- 0.155 (n = 20; first half +0.034, second half -0.230)
  the interval is wide: roughly 76 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.057 +/- 0.057 (n = 20; first half +0.057, second half +0.058)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## serie_a (20 scored)
- vs base rates: no detectable difference: -0.054 +/- 0.200 (n = 20; first half -0.191, second half +0.084)
  the interval is wide: roughly 126 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.021 +/- 0.087 (n = 20; first half -0.047, second half +0.090)
  the interval is wide: roughly 376 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    10  0.17      0.20      0.06-0.51
home     20%-40%   39  0.31      0.33      0.21-0.49
home     40%-60%   31  0.50      0.61      0.44-0.76
home     60%-80%   14  0.69      0.86      0.60-0.96
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    11  0.16      0.27      0.10-0.57
draw     20%-40%   85  0.25      0.21      0.14-0.31
away     0%-20%    22  0.14      0.05      0.01-0.22
away     20%-40%   44  0.31      0.18      0.10-0.32
away     40%-60%   26  0.49      0.62      0.43-0.78
away     60%-80%    4  0.66      0.50      0.15-0.85
