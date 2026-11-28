# Live track record (2026-11-28T09:25:27Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 304 (1 voided, 0 invalid); missed: 0; scored: 303; awaiting a result: 0

## all (303 scored)
- vs base rates: model better: -0.105 +/- 0.041 (n = 303; first half -0.117, second half -0.093)
- vs market: no detectable difference: +0.014 +/- 0.015 (n = 298; first half +0.010, second half +0.019)

## bundesliga (55 scored)
- vs base rates: no detectable difference: -0.090 +/- 0.101 (n = 55; first half -0.032, second half -0.146)
  the interval is wide: roughly 88 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.019 +/- 0.034 (n = 54; first half -0.034, second half -0.004)
  the interval is wide: roughly 157 matches are needed to detect a gap the size the backtest found

## la_liga (61 scored)
- vs base rates: model better: -0.138 +/- 0.081 (n = 61; first half -0.159, second half -0.118)
  the interval is wide: roughly 62 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.044 +/- 0.034 (n = 60; first half +0.042, second half +0.047)
  the interval is wide: roughly 174 matches are needed to detect a gap the size the backtest found

## ligue_1 (55 scored)
- vs base rates: model better: -0.112 +/- 0.092 (n = 55; first half -0.163, second half -0.062)
  the interval is wide: roughly 74 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.022 +/- 0.035 (n = 54; first half -0.012, second half +0.055)
  the interval is wide: roughly 162 matches are needed to detect a gap the size the backtest found

## premier_league (61 scored)
- vs base rates: no detectable difference: -0.024 +/- 0.085 (n = 61; first half -0.074, second half +0.024)
  the interval is wide: roughly 69 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.019 +/- 0.032 (n = 60; first half +0.044, second half -0.006)
  the interval is wide: roughly 155 matches are needed to detect a gap the size the backtest found

## serie_a (71 scored)
- vs base rates: model better: -0.153 +/- 0.094 (n = 71; first half -0.172, second half -0.134)
  the interval is wide: roughly 98 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.005 +/- 0.033 (n = 70; first half +0.009, second half +0.001)
  the interval is wide: roughly 185 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    24  0.16      0.12      0.04-0.31
home     20%-40%  113  0.31      0.36      0.28-0.45
home     40%-60%  108  0.49      0.53      0.43-0.62
home     60%-80%   53  0.67      0.75      0.62-0.85
home     80%-100%   5  0.85      0.80      0.38-0.96
draw     0%-20%    37  0.16      0.16      0.08-0.31
draw     20%-40%  266  0.25      0.23      0.18-0.28
away     0%-20%    72  0.14      0.10      0.05-0.19
away     20%-40%  143  0.30      0.23      0.17-0.31
away     40%-60%   76  0.49      0.55      0.44-0.66
away     60%-80%   12  0.68      0.83      0.55-0.95
