# Live track record (2026-10-26T14:30:46Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 143 (1 voided, 0 invalid); missed: 0; scored: 142; awaiting a result: 0

## all (142 scored)
- vs base rates: model better: -0.111 +/- 0.057 (n = 142; first half -0.116, second half -0.106)
- vs market: no detectable difference: +0.010 +/- 0.031 (n = 96; first half +0.002, second half +0.019)
  the interval is wide: roughly 225 matches are needed to detect a gap the size the backtest found

## bundesliga (27 scored)
- vs base rates: no detectable difference: -0.032 +/- 0.142 (n = 27; first half -0.027, second half -0.036)
  the interval is wide: roughly 86 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.031 +/- 0.068 (n = 18; first half -0.034, second half -0.028)
  the interval is wide: roughly 207 matches are needed to detect a gap the size the backtest found

## la_liga (29 scored)
- vs base rates: model better: -0.163 +/- 0.100 (n = 29; first half -0.208, second half -0.121)
  the interval is wide: roughly 46 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.029 +/- 0.053 (n = 20; first half +0.083, second half -0.026)
  the interval is wide: roughly 143 matches are needed to detect a gap the size the backtest found

## ligue_1 (26 scored)
- vs base rates: model better: -0.157 +/- 0.126 (n = 26; first half -0.240, second half -0.074)
  the interval is wide: roughly 65 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.033 +/- 0.070 (n = 18; first half -0.040, second half -0.025)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

## premier_league (30 scored)
- vs base rates: no detectable difference: -0.074 +/- 0.122 (n = 30; first half -0.055, second half -0.093)
  the interval is wide: roughly 71 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.057 +/- 0.057 (n = 20; first half +0.057, second half +0.058)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## serie_a (30 scored)
- vs base rates: no detectable difference: -0.129 +/- 0.147 (n = 30; first half -0.073, second half -0.185)
  the interval is wide: roughly 102 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.021 +/- 0.087 (n = 20; first half -0.047, second half +0.090)
  the interval is wide: roughly 376 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    12  0.17      0.17      0.05-0.45
home     20%-40%   52  0.31      0.31      0.20-0.44
home     40%-60%   51  0.50      0.55      0.41-0.68
home     60%-80%   25  0.68      0.76      0.57-0.89
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    19  0.17      0.21      0.09-0.43
draw     20%-40%  123  0.25      0.24      0.18-0.33
away     0%-20%    34  0.14      0.06      0.02-0.19
away     20%-40%   66  0.30      0.23      0.14-0.34
away     40%-60%   37  0.49      0.57      0.41-0.71
away     60%-80%    5  0.67      0.60      0.23-0.88
