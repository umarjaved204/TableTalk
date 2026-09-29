"""The live track record: scoring locked predictions once results arrive.

Only **live locks** are scored: predictions the daily run made and locked
before kick-off (tabletalk.pipeline.locks). Voided locks (postponed, suspended,
cancelled) and invalid ones (not made before the actual kick-off) are counted
but never scored. Matches played before the pipeline first ran have no locks,
and backtest or retrospective predictions are never mixed in here.

Each scored match is compared, on the same matches, with:

- **base rates**: the league's historical home/draw/away frequencies before
  the match (the "knowing nothing" forecaster used throughout the project);
- **the market**: closing odds from football-data.co.uk with the margin removed
  proportionally (a flagged assumption, as in the backtest). They appear in
  those files a few days after the match, so the market comparison trails.

Wording rule: differences are quoted as mean difference in log loss +/- a 95%
interval (1.96 standard errors of the per-match difference). If the interval
includes zero, the verdict is "no detectable difference". A difference that
holds in only one half of the matches (in date order) is "consistently better
but modest" (or worse), never "beats". Early in the season the sample is
small and the intervals are wide: the report says how wide.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from ..config import load_competition
from ..data import load_matches
from ..data.loaders import build_loaders
from ..evaluation.backtest import base_rates
from ..evaluation.calibration import calibration_table
from ..evaluation.market import implied_probabilities, load_market_odds
from ..evaluation.metrics import outcomes_from_goals
from .locks import LockStore, scoreable_locks
from .snapshot import CONTRACT_VERSION

#: Log-loss gaps seen in the backtest (report seasons, README), used only to say
#: roughly how many matches a live comparison needs before it can detect them.
BACKTEST_GAPS = {"base rates": 0.08, "market": 0.02}
CALIBRATION_EDGES = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)


@dataclass
class Comparison:
    against: str
    n: int
    model_log_loss: float | None
    other_log_loss: float | None
    diff: float | None          # model minus other; negative = model better
    ci95: float | None
    first_half: float | None
    second_half: float | None
    verdict: str
    matches_needed: int | None  # to detect the backtest's gap at this spread


def verdict(diffs: np.ndarray) -> tuple[str, float | None, float | None, float | None, float | None]:
    """(verdict, mean, ci95, first-half mean, second-half mean) for per-match differences in date order."""
    n = len(diffs)
    if n == 0:
        return "no scored matches yet", None, None, None, None
    mean = float(diffs.mean())
    if n < 2:
        return "too few matches to compare", mean, None, None, None
    ci = float(1.96 * diffs.std(ddof=1) / np.sqrt(n))
    half = n // 2
    first, second = float(diffs[:half].mean()), float(diffs[half:].mean())
    if abs(mean) <= ci:
        return "no detectable difference", mean, ci, first, second
    better = mean < 0
    both_halves = (first < 0) == better and (second < 0) == better
    if both_halves:
        text = "model better" if better else "model worse"
    else:
        text = "consistently better but modest" if better else "consistently worse but modest"
    return text, mean, ci, first, second


def compare(scored: pd.DataFrame, column: str, against: str) -> Comparison:
    if column not in scored.columns or scored.empty:
        return Comparison(against, 0, None, None, None, None, None, None, "no scored matches yet", None)
    rows = scored.dropna(subset=[column]).sort_values("kickoff")
    model, other = rows["ll_model"].to_numpy(), rows[column].to_numpy()
    text, mean, ci, first, second = verdict(model - other)
    needed = None
    if len(rows) >= 2:
        spread = float(np.std(model - other, ddof=1))
        needed = int(np.ceil((1.96 * spread / BACKTEST_GAPS[against]) ** 2))
    return Comparison(
        against=against, n=len(rows),
        model_log_loss=float(model.mean()) if len(rows) else None,
        other_log_loss=float(other.mean()) if len(rows) else None,
        diff=mean, ci95=ci, first_half=first, second_half=second, verdict=text, matches_needed=needed,
    )


def score(store: LockStore, *, refresh: bool = False) -> tuple[pd.DataFrame, dict]:
    """Every scoreable lock that has a result, with each forecaster's log loss."""
    events = store.events()  # raises if the chain is broken
    locks, counts = scoreable_locks(events)
    frames = []
    for competition, group in locks.groupby("competition", sort=True):
        config = load_competition(competition)
        results = _results(config, refresh=refresh)
        joined = group.merge(results, on="match_id", how="left")
        awaiting = joined["home_goals"].isna()
        counts["awaiting_result"] = counts.get("awaiting_result", 0) + int(awaiting.sum())
        awarded = joined["result_status"] == "AWARDED"
        counts["awarded_not_scored"] = counts.get("awarded_not_scored", 0) + int(awarded.sum())
        done = joined.loc[~awaiting & ~awarded].copy()
        if done.empty:
            continue
        done["outcome"] = outcomes_from_goals(done["home_goals"], done["away_goals"])
        history = load_matches(config, save=False)
        base = np.vstack([base_rates(history, config.id, pd.Timestamp(day)) for day in done["date"]])
        done[["b_home", "b_draw", "b_away"]] = base
        done = _add_market(done, config, refresh=refresh)
        frames.append(done)
    scored = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=[*locks.columns, "outcome"])
    if not scored.empty:
        pick = scored["outcome"].to_numpy(dtype=int)
        for prefix, column in (("p", "ll_model"), ("b", "ll_base"), ("m", "ll_market")):
            probs = scored[[f"{prefix}_home", f"{prefix}_draw", f"{prefix}_away"]].to_numpy(dtype=float)
            chosen = probs[np.arange(len(scored)), pick]
            scored[column] = -np.log(np.clip(chosen, 1e-15, 1.0))
    counts["scored"] = len(scored)
    counts.setdefault("awaiting_result", 0)
    counts.setdefault("awarded_not_scored", 0)
    return scored, counts


def _results(config, *, refresh: bool) -> pd.DataFrame:
    """Final scores by the fixture source's match id."""
    frames = [
        loader.load(refresh={config.current_season} if refresh else False)
        for loader in build_loaders(config, role="fixtures")
    ]
    fixtures = pd.concat(frames, ignore_index=True)
    played = fixtures.loc[fixtures["played"].fillna(False).astype(bool)]
    return pd.DataFrame(
        {
            "match_id": played["source_id"].astype(str),
            "date": played["date"],
            "kickoff": played["kickoff_utc"],
            "home_goals": played["home_goals"].astype(float),
            "away_goals": played["away_goals"].astype(float),
            "result_status": played["status"].astype(str),
        }
    )


def _add_market(done: pd.DataFrame, config, *, refresh: bool) -> pd.DataFrame:
    odds = load_market_odds(config, refresh=refresh)
    out = done.copy()
    for column in ("m_home", "m_draw", "m_away"):
        out[column] = np.nan
    if odds.empty:
        return out
    key = ["season", "home_team", "away_team"]
    priced = odds[[*key, "odds_home", "odds_draw", "odds_away"]].dropna().astype({k: str for k in key})
    merged = out[key].astype(str).reset_index().merge(priced, on=key, how="inner")
    if merged.empty:
        return out
    probs, _ = implied_probabilities(merged[["odds_home", "odds_draw", "odds_away"]].to_numpy())
    out.loc[merged["index"], ["m_home", "m_draw", "m_away"]] = probs
    return out


def summarise(scored: pd.DataFrame, counts: dict, *, live_since: str | None, generated_at: pd.Timestamp) -> dict:
    """The track record as a document (contracts/track_record.schema.json)."""
    groups = [("all", scored)]
    if len(scored):
        groups += list(scored.groupby("competition", sort=True))
    competitions = []
    for name, group in groups:
        comparisons = [compare(group, "ll_base", "base rates"), compare(group, "ll_market", "market")]
        competitions.append({"id": name, "n": len(group), "comparisons": [_clean(asdict(c)) for c in comparisons]})
    calibration = []
    if len(scored):
        for index, label in enumerate(("home", "draw", "away")):
            table = calibration_table(
                scored[f"p_{label}"], (scored["outcome"] == index).astype(int), CALIBRATION_EDGES
            )
            for row in table.to_dict(orient="records"):
                calibration.append({"outcome": label, **_clean(row)})
    matches = [
        {
            "lock_id": row.lock_id, "competition": row.competition, "home_team": row.home_team,
            "away_team": row.away_team, "kickoff_utc": _utc(row.kickoff), "predicted_at": row.predicted_at,
            "probabilities": {"home": row.p_home, "draw": row.p_draw, "away": row.p_away},
            "home_goals": int(row.home_goals), "away_goals": int(row.away_goals),
            "log_loss": round(float(row.ll_model), 6), "code_commit": row.code_commit,
        }
        for row in (scored.sort_values("kickoff") if len(scored) else scored).itertuples(index=False)
    ]
    return {
        "contract_version": CONTRACT_VERSION,
        "generated_at": _utc(generated_at),
        "live_since": live_since,
        "chain_verified": True,
        "counts": {key: int(value) for key, value in counts.items()},
        "competitions": competitions,
        "calibration": calibration,
        "matches": matches,
        "notes": [
            "Only predictions locked before kick-off by the daily run are scored. Backtests and "
            "any retrospective predictions are never mixed in.",
            "Differences are model minus the other forecaster in log loss (negative = model "
            "better), with a 95% interval. With few matches the intervals are wide; "
            "`matches_needed` is roughly how many matches it would take to detect a gap the "
            "size the backtest found (0.08 against base rates, 0.02 against the market).",
            "Market probabilities come from closing odds with the margin removed proportionally "
            "(an assumption). They appear a few days after each match.",
        ],
    }


def render(summary: dict) -> str:
    """The track record for a person, following the wording rule."""
    counts = summary["counts"]
    lines = [
        f"# Live track record ({summary['generated_at']})",
        "",
        f"Live since {summary['live_since']}. Lock log hash chain verified.",
        f"Locks: {counts['locks']} ({counts['voided']} voided, {counts['invalid']} invalid); "
        f"missed: {counts['missed']}; scored: {counts['scored']}; awaiting a result: {counts['awaiting_result']}"
        + (f"; awarded, not scored: {counts['awarded_not_scored']}" if counts["awarded_not_scored"] else ""),
        "",
    ]
    for competition in summary["competitions"]:
        lines.append(f"## {competition['id']} ({competition['n']} scored)")
        for c in competition["comparisons"]:
            if c["diff"] is None or c["ci95"] is None:
                lines.append(f"- vs {c['against']}: {c['verdict']} (n = {c['n']})")
                continue
            lines.append(
                f"- vs {c['against']}: {c['verdict']}: {c['diff']:+.3f} +/- {c['ci95']:.3f} "
                f"(n = {c['n']}; first half {c['first_half']:+.3f}, second half {c['second_half']:+.3f})"
            )
            if c["matches_needed"] and c["matches_needed"] > c["n"]:
                lines.append(
                    f"  the interval is wide: roughly {c['matches_needed']} matches are needed to detect "
                    f"a gap the size the backtest found"
                )
        lines.append("")
    if summary["calibration"]:
        lines += ["## Calibration (all leagues)", "", "outcome  bin      n  forecast  observed  95% interval"]
        for row in summary["calibration"]:
            lines.append(
                f"{row['outcome']:<8} {row['bin']:<8} {row['n']:>3}  {row['mean_forecast']:.2f}      "
                f"{row['observed']:.2f}      {row['ci_low']:.2f}-{row['ci_high']:.2f}"
            )
        lines.append("")
    return "\n".join(lines)


def write_track_record(store: LockStore, out_dir, *, generated_at: pd.Timestamp, refresh: bool = False) -> dict:
    """Score the locks and write ``track_record/summary.json`` and ``report.md``."""
    from .snapshot import validate
    from .update import _write_json, _write_text

    scored, counts = score(store, refresh=refresh)
    live_since = None
    if store.meta_path.exists():
        live_since = json.loads(store.meta_path.read_text(encoding="utf-8"))["live_since"]
    summary = summarise(scored, counts, live_since=live_since, generated_at=generated_at)
    problems = validate(summary, "track_record.schema.json")
    if problems:
        raise RuntimeError(f"track record breaks the data contract: {problems}")
    store.directory.mkdir(parents=True, exist_ok=True)
    _write_json(store.directory / "summary.json", summary)
    _write_text(store.directory / "report.md", render(summary))
    return summary


def _clean(record: dict) -> dict:
    """Plain floats and None instead of numpy types and NaN (JSON-safe)."""
    out = {}
    for key, value in record.items():
        if isinstance(value, (np.floating, float)):
            out[key] = None if np.isnan(value) else round(float(value), 6)
        elif isinstance(value, np.integer):
            out[key] = int(value)
        else:
            out[key] = value
    return out


def _utc(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    stamp = pd.Timestamp(value)
    stamp = stamp.tz_localize("UTC") if stamp.tzinfo is None else stamp.tz_convert("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
