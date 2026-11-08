# Live track record (2026-11-08T07:56:29Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 227 (1 voided, 0 invalid); missed: 0; scored: 226; awaiting a result: 0

## all (226 scored)
- vs base rates: model better: -0.113 +/- 0.047 (n = 226; first half -0.103, second half -0.124)
- vs market: no detectable difference: +0.009 +/- 0.018 (n = 202; first half +0.008, second half +0.010)

## bundesliga (42 scored)
- vs base rates: no detectable difference: -0.073 +/- 0.109 (n = 42; first half -0.021, second half -0.126)
  the interval is wide: roughly 78 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.036 +/- 0.041 (n = 36; first half -0.031, second half -0.042)
  the interval is wide: roughly 148 matches are needed to detect a gap the size the backtest found

## la_liga (45 scored)
- vs base rates: model better: -0.156 +/- 0.095 (n = 45; first half -0.186, second half -0.127)
  the interval is wide: roughly 65 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.037 +/- 0.039 (n = 40; first half +0.029, second half +0.045)
  the interval is wide: roughly 151 matches are needed to detect a gap the size the backtest found

## ligue_1 (39 scored)
- vs base rates: model better: -0.166 +/- 0.103 (n = 39; first half -0.197, second half -0.136)
  the interval is wide: roughly 65 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.008 +/- 0.041 (n = 36; first half -0.033, second half +0.016)
  the interval is wide: roughly 155 matches are needed to detect a gap the size the backtest found

## premier_league (45 scored)
- vs base rates: no detectable difference: -0.036 +/- 0.100 (n = 45; first half -0.061, second half -0.012)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.043 +/- 0.036 (n = 40; first half +0.057, second half +0.029)
  the interval is wide: roughly 129 matches are needed to detect a gap the size the backtest found

## serie_a (55 scored)
- vs base rates: model better: -0.135 +/- 0.112 (n = 55; first half -0.110, second half -0.159)
  the interval is wide: roughly 109 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.005 +/- 0.041 (n = 50; first half +0.011, second half -0.000)
  the interval is wide: roughly 210 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    20  0.16      0.15      0.05-0.36
home     20%-40%   82  0.31      0.38      0.28-0.49
home     40%-60%   81  0.49      0.54      0.44-0.65
home     60%-80%   39  0.67      0.77      0.62-0.87
home     80%-100%   4  0.84      1.00      0.51-1.00
draw     0%-20%    32  0.17      0.16      0.07-0.32
draw     20%-40%  194  0.26      0.22      0.16-0.28
away     0%-20%    53  0.14      0.09      0.04-0.20
away     20%-40%  108  0.30      0.20      0.14-0.29
away     40%-60%   55  0.48      0.58      0.45-0.70
away     60%-80%   10  0.69      0.80      0.49-0.94
