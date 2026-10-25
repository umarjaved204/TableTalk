# Live track record (2026-10-25T12:43:20Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 122 (1 voided, 0 invalid); missed: 0; scored: 120; awaiting a result: 1

## all (120 scored)
- vs base rates: model better: -0.110 +/- 0.064 (n = 120; first half -0.073, second half -0.147)
- vs market: no detectable difference: +0.010 +/- 0.031 (n = 96; first half +0.002, second half +0.019)
  the interval is wide: roughly 225 matches are needed to detect a gap the size the backtest found

## bundesliga (25 scored)
- vs base rates: no detectable difference: -0.021 +/- 0.136 (n = 25; first half -0.018, second half -0.024)
  the interval is wide: roughly 73 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.031 +/- 0.068 (n = 18; first half -0.034, second half -0.028)
  the interval is wide: roughly 207 matches are needed to detect a gap the size the backtest found

## la_liga (25 scored)
- vs base rates: model better: -0.188 +/- 0.111 (n = 25; first half -0.176, second half -0.200)
  the interval is wide: roughly 49 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.029 +/- 0.053 (n = 20; first half +0.083, second half -0.026)
  the interval is wide: roughly 143 matches are needed to detect a gap the size the backtest found

## ligue_1 (20 scored)
- vs base rates: model better: -0.194 +/- 0.152 (n = 20; first half -0.181, second half -0.206)
  the interval is wide: roughly 73 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.033 +/- 0.070 (n = 18; first half -0.040, second half -0.025)
  the interval is wide: roughly 222 matches are needed to detect a gap the size the backtest found

## premier_league (25 scored)
- vs base rates: no detectable difference: -0.069 +/- 0.145 (n = 25; first half +0.006, second half -0.139)
  the interval is wide: roughly 83 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.057 +/- 0.057 (n = 20; first half +0.057, second half +0.058)
  the interval is wide: roughly 165 matches are needed to detect a gap the size the backtest found

## serie_a (25 scored)
- vs base rates: no detectable difference: -0.094 +/- 0.164 (n = 25; first half -0.032, second half -0.151)
  the interval is wide: roughly 105 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.021 +/- 0.087 (n = 20; first half -0.047, second half +0.090)
  the interval is wide: roughly 376 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%    10  0.17      0.20      0.06-0.51
home     20%-40%   46  0.31      0.33      0.21-0.47
home     40%-60%   41  0.50      0.56      0.41-0.70
home     60%-80%   21  0.68      0.81      0.60-0.92
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    15  0.16      0.20      0.07-0.45
draw     20%-40%  105  0.25      0.22      0.15-0.31
away     0%-20%    30  0.14      0.07      0.02-0.21
away     20%-40%   54  0.30      0.22      0.13-0.35
away     40%-60%   32  0.48      0.59      0.42-0.74
away     60%-80%    4  0.66      0.50      0.15-0.85
