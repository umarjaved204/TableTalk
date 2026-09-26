"""Loader registry.

Competition configs name a loader by string (``data.sources[].loader``); this
module maps that string to a class. Adding a source is: write the subclass,
register it here, reference it from a config.
"""

from __future__ import annotations

from typing import Any, Type

from ...config import CompetitionConfig, DataSource
from .base import MatchLoader
from .football_data_uk import FootballDataUKLoader
from .openfootball import OpenFootballLoader

_REGISTRY: dict[str, Type[MatchLoader]] = {
    FootballDataUKLoader.name: FootballDataUKLoader,
    OpenFootballLoader.name: OpenFootballLoader,
}


def available_loaders() -> list[str]:
    return sorted(_REGISTRY)


def register_loader(loader_class: Type[MatchLoader]) -> Type[MatchLoader]:
    """Register a loader class (usable as a decorator)."""
    if not loader_class.name:
        raise ValueError(f"{loader_class.__name__} must set a class-level `name`")
    _REGISTRY[loader_class.name] = loader_class
    return loader_class


def get_loader_class(name: str) -> Type[MatchLoader]:
    try:
        return _REGISTRY[name]
    except KeyError as exc:
        raise KeyError(
            f"unknown loader {name!r}; registered loaders: {', '.join(available_loaders())}"
        ) from exc


def build_loader(spec: DataSource, competition: str, **overrides: Any) -> MatchLoader:
    """Instantiate the loader described by one config data source."""
    loader_class = get_loader_class(spec.loader)
    return loader_class(competition, **{**dict(spec.params), **overrides})


def build_loaders(
    config: CompetitionConfig, *, role: str | None = None, **overrides: Any
) -> list[MatchLoader]:
    """One loader per data source in a competition config, in config order.

    ``role`` restricts to results sources or fixture sources (see
    ``tabletalk.config.KNOWN_SOURCE_ROLES``).
    """
    specs = config.data_sources if role is None else config.sources_with_role(role)
    return [build_loader(spec, config.id, **overrides) for spec in specs]


__all__ = [
    "MatchLoader",
    "FootballDataUKLoader",
    "OpenFootballLoader",
    "available_loaders",
    "register_loader",
    "get_loader_class",
    "build_loader",
    "build_loaders",
]
