# Live track record (2026-11-07T07:45:13Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 208 (1 voided, 0 invalid); missed: 0; scored: 207; awaiting a result: 0

## all (207 scored)
- vs base rates: model better: -0.101 +/- 0.049 (n = 207; first half -0.100, second half -0.103)
- vs market: no detectable difference: +0.009 +/- 0.018 (n = 202; first half +0.008, second half +0.010)

## bundesliga (37 scored)
- vs base rates: no detectable difference: -0.026 +/- 0.112 (n = 37; first half -0.032, second half -0.020)
  the interval is wide: roughly 73 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.036 +/- 0.041 (n = 36; first half -0.031, second half -0.042)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## la_liga (41 scored)
- vs base rates: model better: -0.148 +/- 0.101 (n = 41; first half -0.213, second half -0.087)
  the interval is wide: roughly 65 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.037 +/- 0.039 (n = 40; first half +0.029, second half +0.045)
  the interval is wide: roughly 151 matches are needed to detect a gap the size the backtest found

## ligue_1 (37 scored)
- vs base rates: model better: -0.146 +/- 0.104 (n = 37; first half -0.206, second half -0.088)
  the interval is wide: roughly 64 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.008 +/- 0.041 (n = 36; first half -0.033, second half +0.016)
  the interval is wide: roughly 155 matches are needed to detect a gap the size the backtest found

## premier_league (41 scored)
- vs base rates: no detectable difference: -0.047 +/- 0.098 (n = 41; first half -0.098, second half +0.002)
  the interval is wide: roughly 62 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.043 +/- 0.036 (n = 40; first half +0.057, second half +0.029)
  the interval is wide: roughly 129 matches are needed to detect a gap the size the backtest found

## serie_a (51 scored)
- vs base rates: model better: -0.131 +/- 0.119 (n = 51; first half -0.094, second half -0.166)
  the interval is wide: roughly 113 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.005 +/- 0.041 (n = 50; first half +0.011, second half -0.000)
  the interval is wide: roughly 210 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    17  0.15      0.12      0.03-0.34
home     20%-40%   76  0.31      0.39      0.29-0.51
home     40%-60%   77  0.49      0.56      0.45-0.66
home     60%-80%   34  0.67      0.74      0.57-0.85
home     80%-100%   3  0.83      1.00      0.44-1.00
draw     0%-20%    26  0.17      0.19      0.09-0.38
draw     20%-40%  181  0.26      0.20      0.15-0.27
away     0%-20%    47  0.14      0.11      0.05-0.23
away     20%-40%  102  0.30      0.21      0.14-0.29
away     40%-60%   49  0.49      0.59      0.45-0.72
away     60%-80%    9  0.69      0.78      0.45-0.94
