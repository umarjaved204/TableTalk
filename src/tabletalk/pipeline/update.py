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
from . import checks
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
) -> tuple[LeagueRun, str]:
    """Steps 1-6 for one league. Returns the run and any awarded-match drafts.

    Raises on any failure; nothing is written here.
    """
    season = config.current_season
    refresh_seasons = {season} if refresh else False
    matches = load_matches(config, refresh=refresh_seasons, save=False)
    context = load_context_matches(config, refresh=refresh_seasons)

    problems = checks.check_fixtures(matches, config, season)
    if problems:
        raise SafetyCheckError(config.id, problems)

    api_frames = [loader.load() for loader in build_loaders(config, role="fixtures") if loader.name == "football_data_org"]
    api = pd.concat(api_frames, ignore_index=True) if api_frames else matches.iloc[0:0]
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
    notices = [f"Results may be late: {warning}" for warning in checks.check_staleness(api, now, max_age=stale_after)]
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
    return run, review.draft_entries(config.id)


def updated_today(out_dir: Path, now: pd.Timestamp | None = None) -> bool:
    """True if the latest run is from today (UTC) and updated every league.

    The scheduled backup run uses this to do nothing when the main run already
    succeeded. A run that failed or flagged any league does not count, so the
    backup tries again.
    """
    index_path = out_dir / "latest" / "index.json"
    if not index_path.exists():
        return False
    index = json.loads(index_path.read_text(encoding="utf-8"))
    today = (now or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").strftime("%Y-%m-%d")
    return index["generated_at"][:10] == today and all(
        entry["status"] == "updated" for entry in index["competitions"]
    )


@dataclass
class RunResult:
    outcomes: list[LeagueOutcome]
    track_record_error: str | None = None

    @property
    def ok(self) -> bool:
        """Everything updated, nothing flagged. False fails the scheduled run, so a person is told."""
        return (
            all(outcome.ok and not outcome.warnings for outcome in self.outcomes)
            and self.track_record_error is None
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
) -> RunResult:
    """Run every league, write the ones that passed, then lock and score.

    Never raises for a league's failure. ``locked_at`` (tests only) stands in
    for the moment the predictions were written.
    """
    now = (now or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").floor("s")
    run_date = now.strftime("%Y-%m-%d")
    outcomes = []
    for competition in competitions or available_competitions():
        config = load_competition(competition)
        outcome = LeagueOutcome(competition=config.id, name=config.name)
        started = time.perf_counter()
        try:
            run, drafts = run_league(
                config, run_date=run_date, refresh=refresh, n_simulations=n_simulations,
                now=now, stale_after=stale_after,
            )
            snapshot = build_snapshot(run, generated_at=now)
            contract = validate(snapshot)
            if contract:
                raise SafetyCheckError(config.id, [f"data contract: {problem}" for problem in contract])
            outcome.snapshot, outcome.awarded_drafts, outcome.notices = snapshot, drafts, run.notices
            outcome.fixtures = run.fixtures
            outcome.warnings = [notice for notice in run.notices if notice.startswith("Results may be late")]
        # A league's failure must not stop the others, and must be reported
        # whatever it was: this is the pipeline's boundary.
        except Exception as exc:  # noqa: BLE001
            logger.exception("%s failed", config.id)
            outcome.error = f"{type(exc).__name__}: {exc}"
        outcome.seconds = time.perf_counter() - started
        outcomes.append(outcome)
    history = write_outputs(outcomes, out_dir=out_dir, generated_at=now)
    return RunResult(outcomes, _lock_and_score(outcomes, out_dir, history, now, locked_at))


def _lock_and_score(outcomes, out_dir: Path, history: Path, now, locked_at) -> str | None:
    """Apply the locking rule to every league that updated, then rescore the track record."""
    from .track_record import write_track_record

    store = LockStore(out_dir / "track_record")
    written_at = (locked_at or pd.Timestamp.now(tz="UTC")).tz_convert("UTC").floor("s")
    try:
        for outcome in outcomes:
            if outcome.ok and outcome.fixtures is not None:
                update_locks(
                    store, competition=outcome.competition, snapshot=outcome.snapshot,
                    fixtures=outcome.fixtures, predicted_at=written_at,
                    snapshot_file=f"{history.relative_to(out_dir).as_posix()}/{outcome.competition}.json",
                )
        write_track_record(store, out_dir, generated_at=now)
    # The run's boundary: report any failure here, whatever it was.
    except Exception as exc:  # noqa: BLE001
        logger.exception("locking / track record failed")
        error = f"{type(exc).__name__}: {exc}"
        note = (
            f"\n## Locks and track record: FAILED\n\n{error}\n\n"
            "The snapshots above were written. Existing locks were not edited (the log is append-only).\n"
        )
        for directory in (history, out_dir / "latest"):
            report = directory / "run_report.md"
            _write_text(report, report.read_text(encoding="utf-8") + note)
        return error
    return None


def write_outputs(outcomes: list[LeagueOutcome], *, out_dir: Path, generated_at: pd.Timestamp) -> Path:
    """Write passed leagues; leave failed leagues' previous files alone."""
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
    report = run_report(outcomes, index)
    for directory in (history, latest):
        _write_json(directory / "index.json", index)
        _write_text(directory / "run_report.md", report)
    _write_text(out_dir / "README.md", OUTPUTS_README)
    return history


#: Written at the top of the output directory, which is published as the
#: repository's `data` branch: a visitor landing there needs to know what it is.
OUTPUTS_README = """# TableTalk data

Written by the nightly GitHub Actions run (`python -m tabletalk update`), never by hand.

- `latest/` - the newest snapshot for each league, and `index.json` saying what the last run did
- `history/` - every run's files, never changed afterwards
- `track_record/locks.jsonl` - predictions locked before kick-off (append-only, hash-chained)
- `track_record/summary.json` - locked predictions scored against results

What every field means: `contracts/README.md` on the `main` branch.
Each commit on this branch is one nightly run. The branch is protected against
force-pushes and deletion, so its commit history is strong evidence (not proof) of when
every prediction was published. The hash chain in `locks.jsonl` shows the log was not edited.
"""


def run_report(outcomes: list[LeagueOutcome], index: dict) -> str:
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
        else:
            lines.append(f"- {outcome.name}: FAILED after {outcome.seconds:.0f}s; previous file kept ({entry['status']})")
            lines.extend(f"    {line}" for line in (outcome.error or "").splitlines())
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
