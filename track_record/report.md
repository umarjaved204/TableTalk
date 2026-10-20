# Live track record (2026-10-20T06:34:23Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 96 (1 voided, 0 invalid); missed: 0; scored: 82; awaiting a result: 13

## all (82 scored)
- vs base rates: model better: -0.133 +/- 0.073 (n = 82; first half -0.092, second half -0.174)
- vs market: no detectable difference: +0.013 +/- 0.047 (n = 40; first half -0.008, second half +0.033)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

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

## serie_a (7 scored)
- vs base rates: no detectable difference: -0.030 +/- 0.271 (n = 7; first half -0.229, second half +0.119)
  the interval is wide: roughly 81 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.032 +/- 0.081 (n = 3; first half -0.074, second half -0.011)
  the interval is wide: roughly 50 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%     7  0.17      0.14      0.03-0.51
home     20%-40%   32  0.32      0.31      0.18-0.49
home     40%-60%   30  0.50      0.63      0.46-0.78
home     60%-80%   11  0.69      0.82      0.52-0.95
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    10  0.15      0.30      0.11-0.60
draw     20%-40%   72  0.25      0.21      0.13-0.32
away     0%-20%    19  0.14      0.05      0.01-0.25
away     20%-40%   40  0.30      0.17      0.09-0.32
away     40%-60%   20  0.49      0.65      0.43-0.82
away     60%-80%    3  0.66      0.67      0.21-0.94
