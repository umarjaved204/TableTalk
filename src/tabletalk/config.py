"""Competition configs: load and validate one YAML file per competition.

Design rule for the whole project: if a statement about a competition could be
false for some other competition ("20 teams", "top 4 qualify", "goal difference
is the first tiebreaker"), it belongs in a config file, not in Python.

The dataclasses below are a typed view over the YAML, so mistakes surface at
load time with a clear message instead of as a confusing IndexError deep inside
a simulation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

import yaml

from .paths import COMPETITION_CONFIG_DIR

# ---------------------------------------------------------------------------
# Vocabularies. Anything a config may name must appear here, and each entry is
# implemented exactly once in the codebase.
# ---------------------------------------------------------------------------

#: Tiebreakers the LeagueSimulator knows how to apply, in config-name form.
#: The "head_to_head_*" criteria are computed from the mini-table of matches
#: between the teams that are still level at that step.
KNOWN_TIEBREAKERS: frozenset[str] = frozenset(
    {
        "goal_difference",
        "goals_scored",
        "goals_conceded",          # fewer conceded ranks higher
        "wins",
        "away_wins",               # wins away from home across the whole season
        "away_goals_scored",       # total away goals across the whole season
        "head_to_head_points",
        "head_to_head_goal_difference",
        "head_to_head_goals_scored",
        "head_to_head_away_goals",
        "coin_flip",               # 50/50 (a drawing of lots, or a stand-in for an unmodelled rule)
        "playoff_match",           # a one-off match on a neutral ground, simulated with the match model
        "alphabetical",            # deterministic last resort, used in tests
    }
)

#: How clubs are ordered before any tiebreaker.
#:   points           - total points (every normal season)
#:   points_per_match - points divided by matches played, for a season stopped
#:                      early and decided on the matches that were played
KNOWN_RANKINGS: frozenset[str] = frozenset({"points", "points_per_match"})

#: How a position play-off is played (see ``PositionPlayoff``):
#:   neutral            - one match on a neutral ground
#:   higher_ranked_home - one match at the ground of the club ranked higher on the tiebreakers
#:   two_legs           - home and away, most goals on aggregate (the higher-ranked club at home second)
#: A play-off still level at the end is settled 50/50, standing in for penalties.
KNOWN_PLAYOFF_VENUES: frozenset[str] = frozenset({"neutral", "higher_ranked_home", "two_legs"})

#: Config sections that describe a season's rules, and so may change from one
#: season to the next (``rule_changes``). Everything else (data sources, model
#: settings) belongs to the competition as a whole.
SEASON_RULE_KEYS: tuple[str, ...] = (
    "league", "points", "tiebreakers", "head_to_head_reapply", "head_to_head_needs_all_meetings",
    "zones", "ranking", "position_playoffs", "completed_early",
)

#: What a data source contributes.
#:   results  - authoritative for scores of matches already played
#:   fixtures - authoritative for the schedule: which matches are still to come
#:   context  - results from a *related* competition, used only to inform team
#:              ratings and never simulated or tabulated (e.g. the second tier,
#:              so promoted teams arrive with a rating). Rows carry their own
#:              competition id, set by the source's `competition` param.
#:   check    - a second opinion: its scores must agree with the results (a
#:              mismatch stops the run), but neither its scores nor its schedule
#:              are used for anything else.
#: A competition needs at least one results source, and one fixtures source to be
#: simulable mid-season. At most one source may be the fixture list: two
#: schedules would list every match twice.
KNOWN_SOURCE_ROLES: frozenset[str] = frozenset({"results", "fixtures", "context", "check"})

#: Competition formats, each handled by one simulator.
KNOWN_FORMATS: frozenset[str] = frozenset({"league", "knockout", "hybrid"})


class ConfigError(ValueError):
    """Raised when a competition config is missing or self-contradictory."""


# ---------------------------------------------------------------------------
# Typed config objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PointsSystem:
    """Points awarded per result. Configurable because it is not universal."""

    win: int
    draw: int
    loss: int

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> "PointsSystem":
        return cls(win=int(raw["win"]), draw=int(raw["draw"]), loss=int(raw.get("loss", 0)))


@dataclass(frozen=True)
class LeagueFormat:
    """Shape of a round-robin phase."""

    n_teams: int
    meetings_per_pair: int
    matches_per_team: int
    neutral_venue: bool = False

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> "LeagueFormat":
        n_teams = int(raw["n_teams"])
        meetings = int(raw["meetings_per_pair"])
        matches = int(raw["matches_per_team"])
        fmt = cls(
            n_teams=n_teams,
            meetings_per_pair=meetings,
            matches_per_team=matches,
            neutral_venue=bool(raw.get("neutral_venue", False)),
        )
        # For a plain round robin the three numbers must agree. Formats where
        # they do not (e.g. the Champions League league phase: 36 teams, 8
        # matches each) set meetings_per_pair to 0, meaning "not a round robin".
        if meetings > 0:
            expected = (n_teams - 1) * meetings
            if expected != matches:
                raise ConfigError(
                    f"league format is inconsistent: {n_teams} teams meeting "
                    f"{meetings}x implies {expected} matches per team, config says {matches}"
                )
        return fmt

    @property
    def is_round_robin(self) -> bool:
        """True when every pair meets a fixed number of times."""
        return self.meetings_per_pair > 0

    @property
    def total_matches(self) -> int:
        return self.n_teams * self.matches_per_team // 2


@dataclass(frozen=True)
class Zone:
    """A set of finishing positions we report a probability for."""

    id: str
    label: str
    positions: tuple[int, ...]
    note: str | None = None

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any], n_teams: int) -> "Zone":
        positions = tuple(int(p) for p in raw["positions"])
        if not positions:
            raise ConfigError(f"zone {raw.get('id')!r} lists no positions")
        bad = [p for p in positions if p < 1 or p > n_teams]
        if bad:
            raise ConfigError(
                f"zone {raw.get('id')!r} refers to position(s) {bad}, outside 1..{n_teams}"
            )
        return cls(
            id=str(raw["id"]),
            label=str(raw.get("label", raw["id"])),
            positions=positions,
            note=raw.get("note"),
        )


@dataclass(frozen=True)
class PositionPlayoff:
    """A one-off match that decides one place in the table when clubs are level on points.

    Some leagues do not let tiebreakers decide the positions that matter most:
    since 2022-23, Serie A plays a match when clubs finish level on points for
    the title or for the last place above the relegation zone. ``position`` is
    the higher of the two places at stake (1 for the title; 17 for 17th v 18th):
    if the clubs ranked there and one place below are level on points, they play,
    and the winner takes ``position``. With more clubs level, the ordinary
    tiebreakers decide who occupies those two places first, as the rules say.
    """

    position: int
    venue: str
    label: str

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any], n_teams: int) -> "PositionPlayoff":
        position = int(raw["position"])
        if not 1 <= position < n_teams:
            raise ConfigError(f"position play-off at {position} is outside 1..{n_teams - 1}")
        venue = str(raw.get("venue", "neutral"))
        if venue not in KNOWN_PLAYOFF_VENUES:
            raise ConfigError(f"position play-off venue {venue!r}; expected one of {sorted(KNOWN_PLAYOFF_VENUES)}")
        return cls(position=position, venue=venue, label=str(raw.get("label", f"play-off for {position}")))


@dataclass(frozen=True)
class DataSource:
    """One loader, its role and its parameters (see tabletalk.data.loaders)."""

    loader: str
    role: str = "results"
    params: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> "DataSource":
        role = str(raw.get("role", "results"))
        if role not in KNOWN_SOURCE_ROLES:
            raise ConfigError(
                f"data source {raw.get('loader')!r} has role {role!r}; "
                f"expected one of {sorted(KNOWN_SOURCE_ROLES)}"
            )
        params = dict(raw.get("params", {}))
        if role == "context" and not params.get("competition"):
            raise ConfigError(
                f"context source {raw.get('loader')!r} needs a `competition` param "
                "naming the competition its matches belong to (e.g. championship)"
            )
        return cls(loader=str(raw["loader"]), role=role, params=params)


@dataclass(frozen=True)
class CompetitionConfig:
    """Everything the simulators need to know about one competition."""

    id: str
    name: str
    format: str
    tiebreakers: tuple[str, ...]
    zones: tuple[Zone, ...]
    points: PointsSystem
    data_sources: tuple[DataSource, ...]
    current_season: str
    league: LeagueFormat | None = None
    head_to_head_reapply: bool = False
    head_to_head_needs_all_meetings: bool = False
    ranking: str = "points"
    position_playoffs: tuple[PositionPlayoff, ...] = ()
    completed_early: bool = False
    country: str | None = None
    confederation: str | None = None
    model: Mapping[str, Any] = field(default_factory=dict)
    simulation: Mapping[str, Any] = field(default_factory=dict)
    source_path: Path | None = None
    raw: Mapping[str, Any] = field(default_factory=dict)

    # -- rules that change from season to season ---------------------------
    def for_season(self, season: str | None) -> "CompetitionConfig":
        """This competition with the rules that applied in ``season``.

        A config states the rules in force at the start of its data at the top
        level, and later changes under ``rule_changes``, each either
        ``from_season`` (in force from that season on, until a later change) or
        ``seasons`` (a one-off, e.g. a season stopped early). Every function that
        works on one season's table asks for that season's rules through here,
        so a backtest of 2016-17 uses 2016-17's team count, zones and tiebreakers.
        """
        changes = self.raw.get("rule_changes") or []
        if not changes or season is None:
            return self
        from .data.seasons import Season  # imported here: tabletalk.data imports this module
        merged = {key: value for key, value in self.raw.items() if key != "rule_changes"}
        start = Season.parse(season).start_year
        permanent = sorted(
            (change for change in changes if "from_season" in change),
            key=lambda change: Season.parse(str(change["from_season"])).start_year,
        )
        for change in permanent:
            if Season.parse(str(change["from_season"])).start_year <= start:
                merged.update({key: change[key] for key in SEASON_RULE_KEYS if key in change})
        for change in changes:
            if season in [str(s) for s in change.get("seasons") or ()]:
                merged.update({key: change[key] for key in SEASON_RULE_KEYS if key in change})
        return _build_config(merged, self.source_path, top_level=False)

    # -- convenience accessors used by the simulators -----------------------
    def zone(self, zone_id: str) -> Zone:
        for candidate in self.zones:
            if candidate.id == zone_id:
                return candidate
        raise KeyError(f"competition {self.id!r} has no zone {zone_id!r}")

    def sources_with_role(self, role: str) -> tuple[DataSource, ...]:
        """Data sources contributing results, or the schedule."""
        return tuple(source for source in self.data_sources if source.role == role)

    @property
    def zone_ids(self) -> tuple[str, ...]:
        return tuple(z.id for z in self.zones)

    @property
    def seasons(self) -> tuple[str, ...]:
        """Every season this competition's own sources cover, in config order.

        Context sources are excluded: they describe another competition.
        """
        out: list[str] = []
        for source in self.data_sources:
            if source.role == "context":
                continue
            for season in source.params.get("seasons", []):
                if str(season) not in out:
                    out.append(str(season))
        return tuple(out)

    @property
    def excluded_seasons(self) -> dict[str, str]:
        """Seasons kept out of backtest results (still used for training), with the reason."""
        evaluation = self.raw.get("evaluation") or {}
        excluded = evaluation.get("exclude_seasons") or {}
        return {str(season): " ".join(str(reason).split()) for season, reason in excluded.items()}

    @property
    def evaluation_split(self) -> dict[str, tuple[str, ...]]:
        """Backtest seasons for choosing settings (``tune``) and for results (``report``).

        Empty if the config defines no split. Validated at load time: the two
        lists are disjoint, and every tuning season comes before every report
        season, so a tuned value can never have seen a report-season result.
        """
        evaluation = self.raw.get("evaluation") or {}
        split = evaluation.get("split") or {}
        return {name: tuple(str(s) for s in split.get(name) or ()) for name in ("tune", "report") if name in split}

    @property
    def assumptions(self) -> tuple[Mapping[str, Any], ...]:
        """Modelling assumptions flagged in the config's `verification` block."""
        verification = self.raw.get("verification") or {}
        return tuple(verification.get("assumptions") or ())


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def available_competitions(config_dir: Path | None = None) -> list[str]:
    """Competition ids that have a config file, sorted."""
    directory = config_dir or COMPETITION_CONFIG_DIR
    if not directory.exists():
        return []
    return sorted(
        {p.stem for p in directory.iterdir() if p.suffix in {".yaml", ".yml", ".json"}}
    )


def competition_config_path(competition_id: str, config_dir: Path | None = None) -> Path:
    directory = config_dir or COMPETITION_CONFIG_DIR
    for suffix in (".yaml", ".yml", ".json"):
        candidate = directory / f"{competition_id}{suffix}"
        if candidate.exists():
            return candidate
    available = ", ".join(available_competitions(directory)) or "(none)"
    raise ConfigError(
        f"no config for competition {competition_id!r} in {directory}. Available: {available}"
    )


def load_competition(competition_id: str, config_dir: Path | None = None) -> CompetitionConfig:
    """Load and validate one competition config by id (e.g. "premier_league")."""
    path = competition_config_path(competition_id, config_dir)
    # yaml.safe_load also parses JSON, so one code path covers both formats.
    with path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)
    if not isinstance(raw, dict):
        raise ConfigError(f"{path} does not contain a mapping")
    return _build_config(raw, path)


def _build_config(raw: Mapping[str, Any], path: Path, *, top_level: bool = True) -> CompetitionConfig:
    missing = [key for key in ("id", "name", "format", "points") if key not in raw]
    if missing:
        raise ConfigError(f"{path} is missing required key(s): {', '.join(missing)}")

    fmt = str(raw["format"])
    if fmt not in KNOWN_FORMATS:
        raise ConfigError(
            f"{path}: format {fmt!r} is not supported (known: {sorted(KNOWN_FORMATS)})"
        )

    league = LeagueFormat.from_dict(raw["league"]) if "league" in raw else None
    if fmt in {"league", "hybrid"} and league is None:
        raise ConfigError(f"{path}: format {fmt!r} requires a `league:` section")

    tiebreakers = tuple(str(t) for t in raw.get("tiebreakers", ()))
    unknown = [t for t in tiebreakers if t not in KNOWN_TIEBREAKERS]
    if unknown:
        raise ConfigError(
            f"{path}: unknown tiebreaker(s) {unknown}. Known: {sorted(KNOWN_TIEBREAKERS)}"
        )
    if fmt == "league" and not tiebreakers:
        raise ConfigError(f"{path}: a league needs at least one tiebreaker")

    n_teams = league.n_teams if league else 0
    zones = tuple(Zone.from_dict(z, n_teams) for z in raw.get("zones", ()))
    _check_unique([z.id for z in zones], f"{path}: duplicate zone id")

    ranking = str(raw.get("ranking", "points"))
    if ranking not in KNOWN_RANKINGS:
        raise ConfigError(f"{path}: ranking {ranking!r}; expected one of {sorted(KNOWN_RANKINGS)}")
    playoffs = tuple(PositionPlayoff.from_dict(item, n_teams) for item in raw.get("position_playoffs") or ())

    data_raw: Mapping[str, Any] = raw.get("data") or {}
    sources = tuple(DataSource.from_dict(s) for s in data_raw.get("sources", ()))
    if not sources:
        raise ConfigError(f"{path}: no data sources configured")
    if not any(source.role == "results" for source in sources):
        raise ConfigError(f"{path}: at least one data source must have role `results`")
    if sum(source.role == "fixtures" for source in sources) > 1:
        raise ConfigError(
            f"{path}: more than one data source has role `fixtures`; list one "
            "fixture list and give any other schedule source role `check`"
        )
    current_season = str(data_raw.get("current_season") or "")
    if not current_season:
        raise ConfigError(f"{path}: data.current_season is required")

    config = CompetitionConfig(
        id=str(raw["id"]),
        name=str(raw["name"]),
        format=fmt,
        tiebreakers=tiebreakers,
        zones=zones,
        points=PointsSystem.from_dict(raw["points"]),
        data_sources=sources,
        current_season=current_season,
        league=league,
        head_to_head_reapply=bool(raw.get("head_to_head_reapply", False)),
        head_to_head_needs_all_meetings=bool(raw.get("head_to_head_needs_all_meetings", False)),
        ranking=ranking,
        position_playoffs=playoffs,
        completed_early=bool(raw.get("completed_early", False)),
        country=raw.get("country"),
        confederation=raw.get("confederation"),
        model=dict(raw.get("model") or {}),
        simulation=dict(raw.get("simulation") or {}),
        source_path=path,
        raw=dict(raw),
    )

    if config.id != path.stem:
        raise ConfigError(
            f"{path}: config id {config.id!r} does not match filename stem {path.stem!r}"
        )
    if current_season not in config.seasons:
        raise ConfigError(
            f"{path}: current_season {current_season!r} is not among the seasons "
            f"loaded by the data sources {config.seasons}"
        )
    _check_evaluation_split(config, path)
    if top_level:
        _check_rule_changes(config, path)
    return config


def _check_rule_changes(config: CompetitionConfig, path: Path) -> None:
    """Validate every season-specific rule set now, not when a backtest reaches it."""
    for number, change in enumerate(config.raw.get("rule_changes") or [], start=1):
        where = f"{path}: rule_changes entry {number}"
        if ("from_season" in change) == ("seasons" in change):
            raise ConfigError(f"{where} needs exactly one of `from_season` or `seasons`")
        unknown = set(change) - set(SEASON_RULE_KEYS) - {"from_season", "seasons", "reason", "source"}
        if unknown:
            raise ConfigError(f"{where} changes {sorted(unknown)}, which are not season rules "
                              f"(allowed: {', '.join(SEASON_RULE_KEYS)})")
        if not change.get("reason"):
            raise ConfigError(f"{where} needs a `reason`")
        affected = [str(change["from_season"])] if "from_season" in change else [str(s) for s in change["seasons"]]
        for season in affected:
            if season not in config.seasons:
                raise ConfigError(f"{where} refers to season {season!r}, which is not loaded")
            config.for_season(season)  # builds, and so validates, that season's rules


def _check_evaluation_split(config: CompetitionConfig, path: Path) -> None:
    split = config.evaluation_split
    if not split:
        return
    if set(split) != {"tune", "report"}:
        raise ConfigError(f"{path}: evaluation.split needs both `tune` and `report` season lists")
    completed = config.seasons[: config.seasons.index(config.current_season)]
    for name, seasons in split.items():
        if not seasons:
            raise ConfigError(f"{path}: evaluation.split.{name} is empty")
        for season in seasons:
            if season not in completed:
                raise ConfigError(f"{path}: evaluation.split.{name} season {season!r} is not a completed season in the data")
            if season in config.excluded_seasons:
                raise ConfigError(f"{path}: evaluation.split.{name} season {season!r} is also in exclude_seasons")
    overlap = set(split["tune"]) & set(split["report"])
    if overlap:
        raise ConfigError(f"{path}: evaluation.split tune and report share season(s) {sorted(overlap)}")
    order = {season: i for i, season in enumerate(config.seasons)}
    if max(order[s] for s in split["tune"]) > min(order[s] for s in split["report"]):
        raise ConfigError(f"{path}: evaluation.split must be chronological: every tune season before every report season")


def _check_unique(values: Sequence[str], message: str) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise ConfigError(f"{message}: {value!r}")
        seen.add(value)
