# Live track record (2026-10-18T06:34:35Z)

Live since 2026-09-29T16:31:51Z. Lock log hash chain verified.
Locks: 73 (1 voided, 0 invalid); missed: 0; scored: 72; awaiting a result: 0

## all (72 scored)
- vs base rates: model better: -0.116 +/- 0.089 (n = 72; first half -0.107, second half -0.126)
  the interval is wide: roughly 90 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.003 +/- 0.042 (n = 47; first half -0.019, second half +0.024)
  the interval is wide: roughly 205 matches are needed to detect a gap the size the backtest found

## bundesliga (16 scored)
- vs base rates: no detectable difference: -0.005 +/- 0.175 (n = 16; first half +0.051, second half -0.061)
  the interval is wide: roughly 77 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.034 +/- 0.120 (n = 9; first half +0.029, second half -0.085)
  the interval is wide: roughly 325 matches are needed to detect a gap the size the backtest found

## la_liga (14 scored)
- vs base rates: model better: -0.208 +/- 0.147 (n = 14; first half -0.273, second half -0.144)
  the interval is wide: roughly 48 matches are needed to detect a gap the size the backtest found
- vs market: model worse: +0.079 +/- 0.040 (n = 9; first half +0.072, second half +0.084)
  the interval is wide: roughly 36 matches are needed to detect a gap the size the backtest found

## ligue_1 (13 scored)
- vs base rates: model better: -0.240 +/- 0.202 (n = 13; first half -0.116, second half -0.346)
  the interval is wide: roughly 83 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.040 +/- 0.115 (n = 9; first half -0.114, second half +0.019)
  the interval is wide: roughly 299 matches are needed to detect a gap the size the backtest found

## premier_league (15 scored)
- vs base rates: no detectable difference: -0.055 +/- 0.196 (n = 15; first half -0.060, second half -0.051)
  the interval is wide: roughly 90 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: +0.057 +/- 0.100 (n = 10; first half +0.079, second half +0.036)
  the interval is wide: roughly 249 matches are needed to detect a gap the size the backtest found

## serie_a (14 scored)
- vs base rates: no detectable difference: -0.103 +/- 0.265 (n = 14; first half -0.217, second half +0.012)
  the interval is wide: roughly 154 matches are needed to detect a gap the size the backtest found
- vs market: no detectable difference: -0.047 +/- 0.052 (n = 10; first half -0.047, second half -0.048)
  the interval is wide: roughly 67 matches are needed to detect a gap the size the backtest found

## Calibration (all leagues)

outcome  bin      n  forecast  observed  95% interval
home     0%-20%     8  0.16      0.25      0.07-0.59
home     20%-40%   30  0.31      0.33      0.19-0.51
home     40%-60%   20  0.51      0.55      0.34-0.74
home     60%-80%   12  0.69      0.83      0.55-0.95
home     80%-100%   2  0.84      1.00      0.34-1.00
draw     0%-20%    10  0.16      0.30      0.11-0.60
draw     20%-40%   62  0.25      0.26      0.17-0.38
away     0%-20%    18  0.13      0.06      0.01-0.26
away     20%-40%   30  0.31      0.10      0.03-0.26
away     40%-60%   20  0.49      0.60      0.39-0.78
away     60%-80%    4  0.66      0.50      0.15-0.85
