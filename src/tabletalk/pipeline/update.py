"""The daily update: fetch -> check -> refit -> simulate -> check -> write.

``python -m tabletalk update`` runs this for every configured league. Each
league is handled on its own:

1. fetch the current season from every source (history comes from the local
   cache: it does not change);
2. load and reconcile, which stops on an unmapped team name or two sources
   disagreeing about a score;
3. check the fixture list against the config;
4. handle awarded matches (tabletalk.pipeline.awarded);
5. refit the match model and simulate the rest of the season, with a seed
   derived from the date and the league;
6. check the outputs (tabletalk.pipeline.checks) and validate the snapshot
   against the data contract (contracts/snapshot.schema.json).

Only a league that passed every step is written. A league that failed keeps
its previous published file untouched, the index says so, and the command
exits with an error so the scheduler reports a failed run.

Files (``<out>`` defaults to ``outputs/``):

    <out>/latest/<competition>.json        newest snapshot per league (fixed path)
    <out>/latest/index.json                what the last run did, per league
    <out>/latest/run_report.md             the same, for a person
    <out>/history/<YYYY-MM-DDTHHMMZ>/...   every run's files, never overwritten
    <out>/track_record/locks.jsonl         locked predictions, append-only (pipeline.locks)
    <out>/track_record/summary.json        the live track record (pipeline.track_record)

After the snapshots are written, each league that updated goes through the
locking rule, and the track record is scored again. A problem there (e.g. the
lock log's hash chain is broken) fails the run, but never touches snapshots.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from ..config import CompetitionConfig, available_competitions, load_competition
from ..data import load_context_matches, load_matches, remaining_fixtures
from ..data.loaders import build_loaders
from ..paths import PROJECT_ROOT
from ..simulation import league_table
from ..simulation.league import simulate_league
from . import checks, known_results
from . import state as pipeline_state
from .awarded import review_awarded
from .locks import LockStore, update_locks
from .snapshot import CONTRACT_VERSION, LeagueRun, build_snapshot, run_seed, validate

logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "outputs"

#: A match that kicked off longer ago than this without a result is flagged
#: (results may be late). Two days covers a slow source over a weekend.
DEFAULT_STALE_AFTER = pd.Timedelta(days=2)


class SafetyCheckError(RuntimeError):
    """A check failed: nothing is written for this league."""

    def __init__(self, competition: str, problems: list[str]):
        self.problems = problems
        joined = "\n".join(f"  - {problem}" for problem in problems)
        super().__init__(f"{competition}: {len(problems)} safety check(s) failed:\n{joined}")


@dataclass
class LeagueOutcome:
    competition: str
    name: str
    snapshot: dict | None = None
    error: str | None = None
    seconds: float = 0.0
    awarded_drafts: str = ""
    notices: list[str] = field(default_factory=list)
    fixtures: pd.DataFrame | None = None  # the fixture source's rows, for locking
    warnings: list[str] = field(default_factory=list)  # written, but a person should look
    # Due matches with no final score in this run's data (checks.missing_results):
    # the day is not done while any league has some, so a later try runs again.
    missing: list[dict] = field(default_factory=list)
    called_off: list[dict] = field(default_factory=list)  # postponed / suspended / cancelled
    new_results: list[dict] = field(default_factory=list)  # results first seen in this run, per source

    @property
    def ok(self) -> bool:
        return self.snapshot is not None


def run_league(
    config: CompetitionConfig,
    *,
    run_date: str,
    refresh: bool = True,
    n_simulations: int | None = None,
    now: pd.Timestamp | None = None,
    stale_after: pd.Timedelta = DEFAULT_STALE_AFTER,
    known: dict[tuple[str, str], dict] | None = None,
) -> tuple[LeagueRun, str]:
    """Steps 1-6 for one league. Returns the run and any awarded-match drafts.

    ``known``: this league's remembered results for the current season
    (``state.known_for``); any no source has now are put back
    (``known_results.restore``). Raises on any failure; nothing is written here.
    """
    season = config.current_season
    refresh_seasons = {season} if refresh else False
    matches = load_matches(config, refresh=refresh_seasons, save=False)
    context = load_context_matches(config, refresh=refresh_seasons)

    api_frames = [loader.load() for loader in build_loaders(config, role="fixtures") if loader.name == "football_data_org"]
    api = pd.concat(api_frames, ignore_index=True) if api_frames else matches.iloc[0:0]
    sources_results = known_results.live_results(matches, api, season)
    kept = known_results.restore(matches, api, known or {}, season)
    matches = kept.matches

    problems = checks.check_fixtures(matches, config, season)
    if problems:
        raise SafetyCheckError(config.id, problems)

    review = review_awarded(config, matches, api)

    seed = run_seed(run_date, config.id)
    result = simulate_league(
        config, review.table_matches, context, n_simulations=n_simulations, seed=seed,
        season=season, model_matches=review.model_matches,
    )
    model = result.metadata["model"]
    table = league_table(review.table_matches, config, season)
    upcoming = remaining_fixtures(review.table_matches, config, season)
    predictions = model.predict(upcoming) if len(upcoming) else upcoming.assign(
        p_home=[], p_draw=[], p_away=[], expected_home_goals=[], expected_away_goals=[]
    )
    summary = result.summary()
    positions = result.position_probabilities()

    left = pd.concat([upcoming["home_team"], upcoming["away_team"]]).value_counts()
    teams = summary.index
    problems = [
        *checks.check_match_predictions(predictions),
        *checks.check_simulation(
            positions.loc[teams], summary[[zone.id for zone in config.for_season(season).zones]], config.for_season(season),
            expected_points=summary["expected_points"], points_now=summary["points_now"].astype(float),
            matches_left=left.reindex(teams, fill_value=0).astype(float),
        ),
        *checks.check_table(table, review.table_matches, config, season),
    ]
    simulator_start = result.current_table.set_index("team")["points"].reindex(table["team"])
    if not (simulator_start.to_numpy() == table["points"].to_numpy()).all():
        problems.append("the simulator's starting table differs from the published table")
    if problems:
        raise SafetyCheckError(config.id, problems)

    played = review.table_matches.loc[
        (review.table_matches["season"].astype(str) == season)
        & review.table_matches["played"].fillna(False).astype(bool)
    ].sort_values(["date", "home_team"], kind="stable")
    now = now if now is not None else pd.Timestamp.now(tz="UTC")
    missing = checks.missing_results(api, played, now)
    stopped = checks.called_off(api)
    notices = [
        f"Results may be late: {warning}"
        for warning in checks.check_staleness(api, now, max_age=stale_after, played=played)
    ]
    # Restored results are reported on their own below, not as "behind".
    restored_pairs = {(entry["home_team"], entry["away_team"]) for entry in kept.restored}
    from_sources = played.loc[[pair not in restored_pairs for pair in zip(played["home_team"], played["away_team"])]]
    notices.extend(
        f"Fixture source behind: {note}"
        for note in checks.status_behind_results(api, from_sources, now, max_age=stale_after)
    )
    notices.extend(_known_results_notices(kept))
    if not missing.empty:
        notices.append(
            f"Results not in yet: {len(missing)} match(es) that kicked off at least "
            f"{checks.RESULT_DUE_AFTER / pd.Timedelta(hours=1):g} hours before this run have no final score "
            f"in its data, so these predictions do not include them: "
            + "; ".join(_describe_match(row) for row in missing.itertuples(index=False))
        )
    notices.extend(_called_off_notice(row) for row in stopped.itertuples(index=False))
    for match in review.matches:
        if match.confirmed:
            notices.append(f"Awarded result, confirmed: {match.describe()}")
        else:
            notices.append(
                "PROVISIONAL: an awarded match is not yet confirmed; the table counts the result "
                f"football-data.org reports until it is. {match.describe()}"
            )
    uncertainty = result.metadata.get("uncertainty")
    run = LeagueRun(
        config=config,
        season=season,
        table=table,
        summary=summary,
        positions=positions,
        predictions=predictions,
        model=model,
        seed=seed,
        n_simulations=result.n_simulations,
        promoted_strategy=str(result.metadata.get("strategy")),
        promoted_teams=list(result.metadata.get("promoted") or []),
        uncertainty=_describe(uncertainty),
        latest_result=None if played.empty else played.iloc[-1],
        provisional=review.provisional,
        notices=notices,
    )
    run.fixtures = api
    run.missing = [_match_record(row) for row in missing.itertuples(index=False)]
    run.called_off = [_match_record(row) for row in stopped.itertuples(index=False)]
    run.played_by_source = _played_by_source(config, season)
    run.sources_results = sources_results
    run.forget = {(entry["home_team"], entry["away_team"]) for entry, _why in kept.withdrawn}
    run.kickoffs = {
        (str(row.home_team), str(row.away_team)): _iso(row.kickoff_utc)
        for row in api.itertuples(index=False) if pd.notna(row.kickoff_utc)
    }
    return run, review.draft_entries(config.id)


#: Notices that start like this are warnings: written, but the run fails so a person is told.
WARNING_PREFIXES = ("Results may be late", "Score changed", "Result withdrawn")


def _known_results_notices(kept: known_results.Restored) -> list[str]:
    notices = []
    if kept.restored:
        notices.append(
            f"Results kept from earlier runs: {len(kept.restored)} match(es) had a final score in an earlier "
            "run that no source gives now (football-data.org has listed finished matches as TIMED again for "
            "a while). The table, the predictions and the track record still count them: "
            + "; ".join(known_results.describe(entry) for entry in kept.restored)
        )
    for entry, (home_goals, away_goals) in kept.changed:
        notices.append(
            f"Score changed: {known_results.describe(entry)} when first recorded; the sources now give "
            f"{home_goals}-{away_goals}, which is used from this run on."
        )
    for entry, why in kept.withdrawn:
        notices.append(
            f"Result withdrawn: {known_results.describe(entry)} had a final score in an earlier run but is "
            f"{why}, so it is not counted."
        )
    return notices


def _played_by_source(config: CompetitionConfig, season: str) -> dict[str, set[tuple[str, str]]]:
    """For each results source, the (home, away) pairs it has a final score for this season.

    Reads what this run already fetched (the sources' caches were refreshed
    above), so it costs no downloads. Only feeds the "first seen" log, which is
    informational: if it fails, the log misses one run and the update goes on.
    """
    out: dict[str, set[tuple[str, str]]] = {}
    try:
        for loader in build_loaders(config, role="results", seasons=[season]):
            frame = loader.load()
            rows = frame.loc[(frame["season"].astype(str) == season) & frame["played"].fillna(False).astype(bool)]
            out[loader.name] = set(zip(rows["home_team"].astype(str), rows["away_team"].astype(str)))
    # Informational only: never let it fail a league that passed every check.
    except Exception:  # noqa: BLE001
        logger.exception("%s: could not read the results sources for the first-seen log", config.id)
        return {}
    return out


def _iso(value) -> str | None:
    return None if pd.isna(value) else pd.Timestamp(value).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


def _match_record(row) -> dict:
    return {
        "match_id": None if pd.isna(getattr(row, "source_id", None)) else str(row.source_id),
        "home_team": str(row.home_team), "away_team": str(row.away_team),
        "date": pd.Timestamp(row.date).strftime("%Y-%m-%d"), "kickoff_utc": _iso(row.kickoff_utc),
        "status": str(row.status),
    }


def _describe_match(row) -> str:
    when = (f"{pd.Timestamp(row.kickoff_utc):%d %b %H:%M} UTC" if pd.notna(row.kickoff_utc)
            else f"{pd.Timestamp(row.date):%d %b}")
    return f"{row.home_team} v {row.away_team} ({when}, {row.status})"


#: What each called-off status means for the outputs, in the snapshot notices.
CALLED_OFF_EXPLAINED = {
    "POSTPONED": "It stays in the matches still to play. Any locked prediction for it is voided and "
                 "not scored; a new one is made before the new kick-off.",
    "SUSPENDED": "It was stopped part-way and counts as not yet played. Any locked prediction for it "
                 "is voided and not scored.",
    "CANCELLED": "It is still simulated as a match to be played (assumption: cancelled matches are almost "
                 "always replayed). Any locked prediction for it is voided and not scored. If it is "
                 "scrapped or awarded instead, it goes into configs/awarded_results.yaml.",
}


def _called_off_notice(row) -> str:
    return (f"{str(row.status).capitalize()}: {row.home_team} v {row.away_team} "
            f"(listed for {pd.Timestamp(row.date):%d %b}). {CALLED_OFF_EXPLAINED[str(row.status)]}")


def done_today(out_dir: Path, competitions: list[str] | None = None, now: pd.Timestamp | None = None) -> bool:
    """True if today's latest run updated every league and no results were missing.

    Later scheduled tries use this to do nothing once the day is done. A
    failed league, or a match that should have finished but had no final score
    in the run's data, means not done: the next try runs the update again. See
    ``state.done_today``: anything unexpected also means not done.
    """
    return pipeline_state.done_today(out_dir, competitions or available_competitions(), now)


@dataclass
class RunResult:
    outcomes: list[LeagueOutcome]
    track_record_error: str | None = None
    last_try: bool = False  # the day's last scheduled try: missing results are now a failure
    run_warnings: list[str] = field(default_factory=list)  # in the report; do not fail the run

    @property
    def ok(self) -> bool:
        """Everything updated, nothing flagged. False fails the scheduled run, so a person is told.

        Missing results fail the run only on the day's last try: earlier tries
        publish what they have and leave the rest to the next try.
        """
        return (
            all(outcome.ok and not outcome.warnings for outcome in self.outcomes)
            and self.track_record_error is None
            and not (self.last_try and any(outcome.missing for outcome in self.outcomes))
        )


def run_update(
    competitions: list[str] | None = None,
    *,
    out_dir: Path = DEFAULT_OUTPUT_DIR,
    refresh: bool = True,
    n_simulations: int | None = None,
    now: pd.Timestamp | None = None,
    locked_at: pd.Timestamp | None = None,
    stale_after: pd.Timedelta = DEFAULT_STALE_AFTER,
    last_try: bool = False,
) -> RunResult:
    """Run every league, write the ones that passed, then lock and score.

    Never raises for a league's failure. ``locked_at`` (tests only) stands in
    for the moment the predictions were written. ``last_try``: this is the
    day's last scheduled try, so results still missing fail the run.
    """
    now = (now or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").floor("s")
    run_date = now.strftime("%Y-%m-%d")
    first_today = not pipeline_state.published_today(out_dir, now)
    outcomes = []
    known = pipeline_state.read_known_results(out_dir)
    for competition in competitions or available_competitions():
        config = load_competition(competition)
        outcome = LeagueOutcome(competition=config.id, name=config.name)
        started = time.perf_counter()
        try:
            run, drafts = run_league(
                config, run_date=run_date, refresh=refresh, n_simulations=n_simulations,
                now=now, stale_after=stale_after,
                known=pipeline_state.known_for(known, config.id, config.current_season),
            )
            snapshot = build_snapshot(run, generated_at=now)
            contract = validate(snapshot)
            if contract:
                raise SafetyCheckError(config.id, [f"data contract: {problem}" for problem in contract])
            # Before the league counts as written: the track record reads this file next.
            pipeline_state.record_known_results(
                out_dir, competition=config.id, season=run.season, results=run.sources_results,
                forget=run.forget, recorded_at=now,
            )
            outcome.snapshot, outcome.awarded_drafts, outcome.notices = snapshot, drafts, run.notices
            outcome.fixtures = run.fixtures
            outcome.warnings = [notice for notice in run.notices if notice.startswith(WARNING_PREFIXES)]
            outcome.missing, outcome.called_off = run.missing, run.called_off
            outcome.new_results = pipeline_state.record_results_seen(
                out_dir, competition=config.id, season=run.season, played_by_source=run.played_by_source,
                kickoffs=run.kickoffs, seen_at=now,
            )
        # A league's failure must not stop the others, and must be reported
        # whatever it was: this is the pipeline's boundary.
        except Exception as exc:  # noqa: BLE001
            logger.exception("%s failed", config.id)
            outcome.error = f"{type(exc).__name__}: {exc}"
        outcome.seconds = time.perf_counter() - started
        outcomes.append(outcome)
    history = write_outputs(outcomes, out_dir=out_dir, generated_at=now, last_try=last_try)
    written_at = (locked_at or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").floor("s")
    error, events = _lock_and_score(outcomes, out_dir, history, now, written_at)
    run_warnings = []
    if first_today:
        timing = first_update_timing(outcomes, published_at=written_at, run_date=run_date)
        if timing:
            run_warnings.append(timing)
    _append_report(out_dir, history, _after_locking_report(events, run_warnings))
    return RunResult(outcomes, error, last_try=last_try, run_warnings=run_warnings)


def _lock_and_score(outcomes, out_dir: Path, history: Path, now, written_at) -> tuple[str | None, list[dict]]:
    """Apply the locking rule to every league that updated, then rescore the track record.

    Returns the error (None if all went well) and the lock events this run added.
    """
    from .track_record import write_track_record

    store = LockStore(out_dir / "track_record")
    events: list[dict] = []
    try:
        for outcome in outcomes:
            if outcome.ok and outcome.fixtures is not None:
                events += update_locks(
                    store, competition=outcome.competition, snapshot=outcome.snapshot,
                    fixtures=outcome.fixtures, predicted_at=written_at,
                    snapshot_file=f"{history.relative_to(out_dir).as_posix()}/{outcome.competition}.json",
                )
        write_track_record(store, out_dir, generated_at=now)
    # The run's boundary: report any failure here, whatever it was.
    except Exception as exc:  # noqa: BLE001
        logger.exception("locking / track record failed")
        error = f"{type(exc).__name__}: {exc}"
        _append_report(out_dir, history, (
            f"\n## Locks and track record: FAILED\n\n{error}\n\n"
            "The snapshots above were written. Existing locks were not edited (the log is append-only).\n"
        ))
        return error, events
    return None, events


#: The day's first update should publish at least this long before the first kick-off.
FIRST_UPDATE_MARGIN = pd.Timedelta(minutes=60)


def first_update_timing(outcomes: list[LeagueOutcome], *, published_at: pd.Timestamp, run_date: str) -> str | None:
    """A warning if the day's first update published less than an hour before the day's first kick-off.

    Uses the kick-off times (UTC) of every league that updated. None when it
    was in time, or no match with a known time is on today.
    """
    today = []
    for outcome in outcomes:
        if outcome.fixtures is None or outcome.fixtures.empty:
            continue
        kickoff = pd.to_datetime(outcome.fixtures["kickoff_utc"], utc=True)
        on_today = kickoff.notna() & (kickoff.dt.strftime("%Y-%m-%d") == run_date)
        for index in outcome.fixtures.index[on_today]:
            row = outcome.fixtures.loc[index]
            today.append((kickoff[index], f"{outcome.name}: {row['home_team']} v {row['away_team']}"))
    if not today:
        return None
    first, match = min(today, key=lambda item: item[0])
    margin = first - published_at
    if margin >= FIRST_UPDATE_MARGIN:
        return None
    if margin <= pd.Timedelta(0):
        when = f"{-margin / pd.Timedelta(minutes=1):.0f} minutes AFTER"
    else:
        when = f"only {margin / pd.Timedelta(minutes=1):.0f} minutes before"
    return (
        f"The day's first update published at {published_at:%H:%M} UTC, {when} the first kick-off "
        f"({match}, {first:%H:%M} UTC). A match that kicked off before it keeps the previous day's "
        "prediction as its lock, or is recorded as missed if it never had one."
    )


def _after_locking_report(events: list[dict], run_warnings: list[str]) -> str:
    """Report sections that can only be written once the locking step has run."""
    lines = []
    if run_warnings:
        lines += ["", "## Timing", ""] + [f"WARNING: {warning}" for warning in run_warnings]
    voids = [event for event in events if event["event"] == "void"]
    others = [event for event in events if event["event"] in ("invalid", "missed")]
    locks = {event["lock_id"]: event for event in events if event["event"] == "lock"}
    if events:
        lines += ["", "## Locks this run", "", f"- {len(locks)} prediction(s) locked"]
        for event in voids:
            lock = locks.get(event["lock_id"], {})
            match = f"{lock.get('home_team', '?')} v {lock.get('away_team', '?')} " if lock else ""
            lines.append(f"- Voided: {match}({event['lock_id']}): {event['reason']}; not scored")
        for event in others:
            lock = locks.get(event.get("lock_id"), event)  # an invalid names its lock; a missed event has the teams
            lines.append(f"- {event['event'].capitalize()}: {lock.get('home_team', '?')} v {lock.get('away_team', '?')} "
                         f"({event.get('lock_id') or event.get('match_id')}): {event.get('reason', '')}")
    return "\n".join(lines) + ("\n" if lines else "")


def _append_report(out_dir: Path, history: Path, text: str) -> None:
    if not text:
        return
    for directory in (history, out_dir / "latest"):
        report = directory / "run_report.md"
        _write_text(report, report.read_text(encoding="utf-8") + text)


def write_outputs(
    outcomes: list[LeagueOutcome], *, out_dir: Path, generated_at: pd.Timestamp, last_try: bool = False
) -> Path:
    """Write passed leagues; leave failed leagues' previous files alone. Then record the run's state."""
    stamp = generated_at.strftime("%Y-%m-%dT%H%MZ")
    latest = out_dir / "latest"
    history = out_dir / "history" / stamp
    latest.mkdir(parents=True, exist_ok=True)
    history.mkdir(parents=True, exist_ok=True)

    entries = []
    for outcome in outcomes:
        filename = f"{outcome.competition}.json"
        if outcome.ok:
            _write_json(history / filename, outcome.snapshot)
            _write_json(latest / filename, outcome.snapshot)
            source, status = outcome.snapshot, "updated"
        else:
            previous = latest / filename
            source = json.loads(previous.read_text(encoding="utf-8")) if previous.exists() else None
            status = "kept_previous" if source else "no_snapshot"
        entries.append(
            {
                "id": outcome.competition,
                "name": outcome.name,
                "file": filename if source else None,
                "status": status,
                "snapshot_generated_at": source["generated_at"] if source else None,
                "data_through": source["data_through"] if source else None,
                "provisional": source["provisional"] if source else None,
                "error": outcome.error,
                # Only known for a league this run updated.
                "results_complete": not outcome.missing if outcome.ok else None,
                "missing_results": [
                    {key: match[key] for key in ("match_id", "home_team", "away_team", "kickoff_utc")}
                    for match in outcome.missing
                ] if outcome.ok else [],
            }
        )
    index = {
        "contract_version": CONTRACT_VERSION,
        "generated_at": generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "history_path": f"history/{stamp}",
        "competitions": entries,
    }
    problems = validate(index, "index.schema.json")
    if problems:  # pragma: no cover - a bug in this module, not in the data
        raise RuntimeError(f"run index breaks the data contract: {problems}")
    report = run_report(outcomes, index, last_try=last_try)
    for directory in (history, latest):
        _write_json(directory / "index.json", index)
        _write_text(directory / "run_report.md", report)
    _write_text(out_dir / "README.md", OUTPUTS_README)
    # Last: the state says "done" only once everything above is on disk.
    pipeline_state.write_run_state(out_dir, generated_at=generated_at, last_try=last_try, leagues={
        outcome.competition: {
            "updated": outcome.ok,
            "results_complete": outcome.ok and not outcome.missing,
            "missing": [match["match_id"] or f"{match['home_team']} v {match['away_team']}" for match in outcome.missing],
        }
        for outcome in outcomes
    })
    return history


#: Written at the top of the output directory, which is published as the
#: repository's `data` branch: a visitor landing there needs to know what it is.
OUTPUTS_README = """# TableTalk data

Written by the nightly GitHub Actions run (`python -m tabletalk update`), never by hand.

- `latest/` - the newest snapshot for each league, and `index.json` saying what the last run did
- `history/` - every run's files, never changed afterwards
- `track_record/locks.jsonl` - predictions locked before kick-off (append-only, hash-chained)
- `track_record/summary.json` - locked predictions scored against results
- `state/` - working files for the next run (not part of the data contract; do not build on them)

What every field means: `contracts/README.md` on the `main` branch.
Each commit on this branch is one nightly run. The branch is protected against
force-pushes and deletion, so its commit history is strong evidence (not proof) of when
every prediction was published. The hash chain in `locks.jsonl` shows the log was not edited.
"""


def run_report(outcomes: list[LeagueOutcome], index: dict, *, last_try: bool = False) -> str:
    """A short plain-text account of the run, for a person."""
    lines = [f"# TableTalk update, {index['generated_at']}", ""]
    for outcome, entry in zip(outcomes, index["competitions"]):
        if outcome.ok:
            snapshot = outcome.snapshot
            lines.append(
                f"- {outcome.name}: updated in {outcome.seconds:.0f}s; results through "
                f"{snapshot['data_through']}; {len(snapshot['upcoming_matches'])} matches still to play"
                + ("; PROVISIONAL" if snapshot["provisional"] else "")
            )
            lines.extend(f"    WARNING: {warning}" for warning in outcome.warnings)
            if outcome.missing:
                lines.append(f"    Results not in yet ({len(outcome.missing)}): "
                             + "; ".join(_describe_record(match) for match in outcome.missing))
            lines.extend(f"    {match['status'].capitalize()}: {match['home_team']} v {match['away_team']} "
                         f"(listed for {pd.Timestamp(match['date']):%d %b})" for match in outcome.called_off)
        else:
            lines.append(f"- {outcome.name}: FAILED after {outcome.seconds:.0f}s; previous file kept ({entry['status']})")
            lines.extend(f"    {line}" for line in (outcome.error or "").splitlines())
    missing = sum(len(outcome.missing) for outcome in outcomes)
    if missing:
        lines += ["", "## Results not in yet", ""]
        if last_try:
            lines.append(
                f"WARNING: this was the day's last scheduled try, and {missing} match(es) that should have "
                "finished still have no final score. Published without them; the run is marked failed so "
                "you are told. Tomorrow's first try picks them up."
            )
        else:
            lines.append(
                f"{missing} match(es) that should have finished have no final score yet. Published without "
                "them; the next scheduled try today runs the update again."
            )
    if any(outcome.called_off for outcome in outcomes):
        lines += ["", "Postponed, suspended and cancelled matches stay in the matches still to play (a cancelled",
                  "match is assumed to be replayed). Their locked predictions are voided and not scored."]
    seen = [item for outcome in outcomes for item in outcome.new_results]
    if seen:
        lines += ["", "## Results first seen in this run", ""] + pipeline_state.describe_results_seen(seen)
        if any(not item["baseline"] for item in seen):
            lines.append("(First seen = the first of our runs to have it: an upper bound on the source's delay.)")
    drafts = [outcome for outcome in outcomes if outcome.awarded_drafts]
    if drafts:
        lines += [
            "",
            "## Awarded matches to confirm",
            "",
            "Check the league's decision, fill in every TO FILL IN, and add the entry to",
            "configs/awarded_results.yaml. Until then the table is marked provisional.",
            "",
            "```yaml",
            *[outcome.awarded_drafts.rstrip() for outcome in drafts],
            "```",
        ]
    return "\n".join(lines) + "\n"


def _describe_record(match: dict) -> str:
    when = (f"{pd.Timestamp(match['kickoff_utc']):%d %b %H:%M} UTC" if match["kickoff_utc"]
            else f"{pd.Timestamp(match['date']):%d %b}")
    return f"{match['home_team']} v {match['away_team']} ({when}, {match['status']})"


def _write_json(path: Path, document: dict) -> None:
    # Compact: these files are read by a program, and every run adds a copy to history.
    _write_text(path, json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")


def _write_text(path: Path, text: str) -> None:
    """Write to a temporary file, then rename: a reader never sees half a file."""
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)


def _describe(uncertainty) -> str:
    if uncertainty is None or not getattr(uncertainty, "active", False):
        return "none: every simulated season uses today's ratings"
    parts = []
    if getattr(uncertainty, "parameter_uncertainty", False):
        parts.append("each simulated season draws its ratings from the fit's uncertainty")
    if getattr(uncertainty, "drift_variance_per_day", 0) > 0:
        parts.append("ratings drift within the season")
    return "; ".join(parts) or "active"
