# Limitations and roadmap

What the model does not know, where it is known to be wrong, and what comes next.

Contents:

- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

[Back to the README](../README.md)

## Known limitations

- **Nothing about teams beyond results.** No injuries, suspensions, transfers,
  managerial changes, European or cup fixture congestion, or motivation at the end
  of a season. Off-pitch pressures (forced player sales, a transfer ban) reach the
  ratings only through results, as late as any sudden change in strength.
- **Future points deductions are not anticipated.** Only decisions already
  announced are applied. A club facing an open charge is simulated as if it will
  keep every point, so its forecast is too optimistic until a verdict arrives. This
  may matter more from 2026-27, when the Squad Cost Ratio rules bring automatic
  deductions for overspending.
- **Promoted teams start from one shared prior**, however they were built, and it
  weights a promoted team from 2011 the same as one from 2025 although promoted
  sides have been getting weaker. See [Promoted teams](results.md#promoted-teams).
- **Home advantage and rho are single numbers per fit.** Home advantage differs by
  ground and has drifted downwards for a decade; rho is poorly determined by a
  time-decayed sample.
- **Ratings lag a genuinely declining team.** Late in a season the model still
  trusts ratings partly built on last season, where the table has already moved
  (in 4 of 6 report seasons the bottom three at 75% played was the final one);
  and forecasts made mid-to-late season are slightly under-confident. See
  [what is still wrong](results.md#what-is-still-wrong).
- **It cannot pick out likely draws.** Draw forecasts are calibrated but almost
  all sit between 20% and 30%; the betting market's barely vary more.
- **It trails the betting market**, by 0.020 in log loss on the report seasons
  (it closes 83% of the gap from knowing nothing). Part of that is information it
  never sees: team news, line-ups, managerial changes.
- **Strength is assumed to drift slowly.** Time decay is a blunt instrument: it
  cannot capture a team that changes overnight.
- **Early-season forecasts are weakly informed** by the current season and lean on
  previous ones.
- **Cross-league strengths are not comparable** until Phase 3 addresses it: a
  strong team in a weak league looks better than it is.
- **Cups are not modelled**, so European places that depend on cup winners are
  indicative.
- **Single-match forecasts use best-estimate ratings.** Season simulations draw
  ratings from their uncertainty, but `ratings` and the match-level backtest
  report each match from the point estimates. For one match the difference is
  small; it matters when the same uncertainty is shared across a whole season.
- **One home advantage for everyone.** Some grounds are genuinely harder to visit
  than others; the model does not know that.
- **The schedule is taken as given.** Postponements and rearrangements are only
  picked up when the fixture source is refreshed.

## Roadmap

- **Phase 1 — core model + Premier League.** Data layer ✅ · Dixon-Coles ✅ ·
  match-level backtest vs a base-rate baseline ✅ · LeagueSimulator ✅ · season-level
  backtest, calibration plots and results notebook ✅
- **Clean tune/report split** ✅: settings chosen on 2012-13 to 2017-18, results
  reported on 2018-19 and 2021-22 to 2025-26 (see
  [how the settings were chosen](results.md#how-the-settings-were-chosen)).
- **Rating uncertainty in season simulations** ✅, which fixed the early-season
  over-confidence the backtest found (see [the fix](results.md#fixing-the-early-over-confidence)).
  Candidates for the next model iteration, both pointed to by the backtest: an
  explicitly time-varying strength (for the late-season lag), and modelling change
  between seasons separately from change within them (for the mild mid-season
  under-confidence).
- **Phase 2 — La Liga, Serie A, Bundesliga, Ligue 1**, by config; per-league fit
  and per-league validation. ✅ All five leagues, every official final table
  reproduced; rules versioned by season (see [Phase 2](../README.md#phase-2-the-five-leagues-side-by-side)). openfootball already covers all four schedules
  (`es.1`, `it.1`, `de.1`, `fr.1`), including the 18-team leagues.
- **Phase 3 — European competitions**, deliberately deferred until the domestic
  leagues produce good, validated results. It then needs the KnockoutSimulator
  (two legs, aggregate, extra time, penalties), the hybrid
  league-phase-then-bracket format, a European results source, and a way to put
  teams from different leagues on one strength scale.
- **Later** — API, website. Not in scope here.
