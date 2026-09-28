# Protocol: which source should be primary for current-season fixtures?

Written 2026-09-28, **before** the comparison was run (it cannot run until a
football-data.org API key is set). The rule below decides; the numbers do not
get to change the rule.

## The question

For the 2026-27 season, which source should be *primary* for the schedule
(which matches are left, their dates, kick-off times and postponements):
**openfootball** (current) or **football-data.org** (new)? The other one stays as a
cross-check: its scores must agree with the results (a mismatch stops the run),
and differences in dates are reported, not fatal.

## Why it matters

The schedule decides what gets simulated, and from Step 3 onwards the kick-off
time decides when a prediction locks. A kick-off listed too late would let a
"locked" prediction be made after the match started. So date and time accuracy
matter more than anything else here.

## Criteria, per league, 2026-27 up to the day of the run

| # | Criterion | How it is measured | Type |
|---|---|---|---|
| C1 | Complete schedule | The source's schedule alone passes `check_fixture_list` (right teams, right number of matches, balanced home and away) and every name maps | pass/fail |
| C2 | Dates of played matches | For every match football-data.co.uk has a result for (a third, independent source), does the candidate list the same date? Count the disagreements. This shows whether a rescheduled match's date was updated | count, lower is better |
| C3 | Kick-off times in UTC | Upcoming matches with a kick-off time that is in UTC **without an assumption**. football-data.org gives UTC; openfootball gives local time with no zone, so it needs an assumed timezone | count, higher is better |
| C4 | Postponements said explicitly | Does the source mark a match as postponed, or does it just stay unplayed? | yes/no |
| C5 | Operations | Needs a key? Rate limit? Licence and attribution? | reported, not scored |

Also reported, not scored: upcoming matches where the two sources give
different UTC kick-offs (openfootball converted with the league's timezone).
Which one was right can only be known once the match is played, so these
are checked again in the Step 5 trial report.

## Decision rule

football-data.org becomes the primary fixture source if, **in all five leagues**:

1. it passes C1, and
2. its C2 count is no higher than openfootball's, and
3. its C3 count is no lower than openfootball's.

Stated plainly: openfootball scores 0 on C3 by design (its files have no
timezone), so condition 3 cannot go against football-data.org. It is kept
because it is a real difference for locking. In practice the decision turns on
C1 and C2, the two criteria measured against data.

Otherwise openfootball stays primary. If football-data.org fails C1 in only
some leagues, the decision is still made for all five together: one rule for all
five leagues, like the promoted-team strategy.

---

## Result (run 2026-09-28, `python -m tabletalk data compare-fixtures --all --refresh`)

| League | C1 (both) | C2 date mismatches (openfootball / football-data.org) | C3 UTC kick-offs (openfootball / football-data.org) | C4 |
|---|---|---|---|---|
| Premier League | pass | 0 / 0 of 50 | 0 / 330 of 330 | football-data.org only |
| Bundesliga | pass | 0 / 0 of 36 | 0 / 72 of 270 | football-data.org only |
| La Liga | pass | 0 / 0 of 69 | 0 / 31 of 311 | football-data.org only |
| Serie A | pass | 0 / 0 of 50 | 0 / 140 of 330 | football-data.org only |
| Ligue 1 | pass | 0 / 0 of 45 | 0 / 69 of 261 | football-data.org only |

**Decision by the rule: football-data.org is primary.** Stated plainly, the
two data-measured criteria (C1, C2) are a tie: both sources are complete and
both have every played match on the right date. The rule's tie-break is C3,
which openfootball cannot win by design (as noted above).

Found while checking, not part of the rule:

- football-data.org's SCHEDULED matches all sit at 00:00 UTC: a placeholder
  meaning "time not set". The loader now keeps their date and leaves the
  kick-off blank.
- In the Premier League, "TIMED" runs to May 2027, so it includes default
  15:00 slots that TV picks will move. "TIMED" is not "final" (matters for
  locking in Step 3).
- Upcoming matches where the two sources list a different date: Premier
  League 16 (all November; football-data.org already has the TV moves, e.g.
  Everton v Coventry on Friday 6 Nov, where openfootball still has every match
  on Saturday at 15:00), La Liga 6, Serie A 39, Bundesliga and Ligue 1 0.
  Which source was right is checked again once these are played (Step 5).
- Scores: all 250 results played so far agree across football-data.co.uk,
  football-data.org and openfootball.
