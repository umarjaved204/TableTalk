"""Team-name normalisation.

Sources disagree: football-data.co.uk says "Man United", a European results
feed may say "Manchester Utd" and Wikipedia "Manchester United F.C.". If those
are not reconciled, the model silently fits three separate, weaker teams. This
module resolves every raw name to one canonical name using
``configs/team_aliases.yaml``.

Two layers of matching, in order:

1. Exact match on a *fingerprint* of the name: lower-cased, accents stripped,
   punctuation removed, common club suffixes ("FC", "AFC", "CF") dropped. This
   handles "Man Utd" vs "man utd", "Atletico" vs "Atlético", "Arsenal FC" vs
   "Arsenal" without needing an alias entry for each.
2. Explicit aliases from the config, fingerprinted the same way. Anything the
   fingerprint cannot reconcile ("Spurs" -> "Tottenham Hotspur") goes here.

There is deliberately no fuzzy fallback: quietly mapping "Man City" onto
"Manchester United" because the strings look similar would be worse than
failing. Unknown names raise, with close matches suggested so the fix is a
one-line addition to the alias file.
"""

from __future__ import annotations

import difflib
import re
import unicodedata
from pathlib import Path
from typing import Iterable, Mapping

import pandas as pd
import yaml

from ..paths import TEAM_ALIASES_FILE

#: Tokens that are club-type markers rather than part of the name. Dropped only
#: when they appear as the first or last token, so "Athletic Bilbao" keeps its
#: "Athletic" but "Arsenal FC" loses its "FC".
_CLUB_SUFFIX_TOKENS: frozenset[str] = frozenset(
    {"fc", "afc", "cf", "sc", "ac", "bc", "cfc", "fk", "sk", "if", "bk"}
)

#: Dots and apostrophes are deleted rather than turned into spaces, so
#: "A.F.C. Bournemouth" becomes "afc bournemouth" (and then "bournemouth")
#: and "Nott'm Forest" becomes "nottm forest".
_DROPPED_PUNCTUATION = re.compile(r"[.'‘’ʼ`´]")
_PUNCTUATION = re.compile(r"[^\w\s]", flags=re.UNICODE)
_WHITESPACE = re.compile(r"\s+")


class UnknownTeamError(KeyError):
    """Raised when a raw team name cannot be resolved to a canonical name."""


def fingerprint(name: str) -> str:
    """Reduce a team name to a comparison key.

    >>> fingerprint("Atlético Madrid")
    'atletico madrid'
    >>> fingerprint("Brighton & Hove Albion F.C.")
    'brighton and hove albion'
    """
    text = unicodedata.normalize("NFKD", str(name))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.lower().replace("&", " and ")
    text = _DROPPED_PUNCTUATION.sub("", text)
    text = _PUNCTUATION.sub(" ", text)
    tokens = _WHITESPACE.sub(" ", text).strip().split()
    # Strip club-type markers from both ends (but never strip the whole name).
    while len(tokens) > 1 and tokens[0] in _CLUB_SUFFIX_TOKENS:
        tokens = tokens[1:]
    while len(tokens) > 1 and tokens[-1] in _CLUB_SUFFIX_TOKENS:
        tokens = tokens[:-1]
    return " ".join(tokens)


class TeamNameNormaliser:
    """Resolves raw team names to canonical names using an alias map."""

    def __init__(self, aliases: Mapping[str, Iterable[str]]):
        self._canonical: list[str] = list(aliases)
        self._lookup: dict[str, str] = {}
        for canonical, alias_list in aliases.items():
            self._register(canonical, canonical)
            for alias in alias_list or ():
                self._register(alias, canonical)

    # -- construction -------------------------------------------------------
    @classmethod
    def from_file(cls, path: Path | None = None) -> "TeamNameNormaliser":
        path = path or TEAM_ALIASES_FILE
        if not path.exists():
            raise FileNotFoundError(f"team alias file not found: {path}")
        with path.open("r", encoding="utf-8") as handle:
            raw = yaml.safe_load(handle) or {}
        teams = raw.get("teams")
        if not isinstance(teams, dict):
            raise ValueError(f"{path}: expected a top-level `teams:` mapping")
        return cls(teams)

    def _register(self, name: str, canonical: str) -> None:
        key = fingerprint(name)
        if not key:
            raise ValueError(f"alias {name!r} for {canonical!r} is empty after normalising")
        existing = self._lookup.get(key)
        if existing is not None and existing != canonical:
            raise ValueError(
                f"alias {name!r} is ambiguous: maps to both {existing!r} and {canonical!r}"
            )
        self._lookup[key] = canonical

    # -- use ----------------------------------------------------------------
    @property
    def canonical_names(self) -> tuple[str, ...]:
        return tuple(self._canonical)

    def get(self, name: str, default: str | None = None) -> str | None:
        """Canonical name for ``name``, or ``default`` if unknown."""
        return self._lookup.get(fingerprint(name), default)

    def normalise(self, name: str) -> str:
        """Canonical name for ``name``; raises UnknownTeamError if unmapped."""
        canonical = self.get(name)
        if canonical is None:
            raise UnknownTeamError(self._unknown_message([name]))
        return canonical

    def unknown(self, names: Iterable[str]) -> list[str]:
        """The subset of ``names`` that cannot be resolved, de-duplicated."""
        missing = {str(name) for name in names if self.get(str(name)) is None}
        return sorted(missing)

    def normalise_series(self, values: pd.Series, *, strict: bool = True) -> pd.Series:
        """Vectorised normalisation of a column of raw team names.

        With ``strict=False`` unknown names are passed through unchanged, which
        is what ``tabletalk data check`` uses to report them all at once
        instead of failing on the first one.
        """
        unique = pd.unique(values.astype("string").dropna())
        mapping = {name: self.get(name) for name in unique}
        missing = sorted(name for name, canonical in mapping.items() if canonical is None)
        if missing and strict:
            raise UnknownTeamError(self._unknown_message(missing))
        resolved = {name: (canonical or name) for name, canonical in mapping.items()}
        return values.astype("string").map(resolved).astype("string")

    def _unknown_message(self, names: list[str]) -> str:
        lines = [
            f"{len(names)} team name(s) are not in the alias map "
            f"({TEAM_ALIASES_FILE.name}). Add them under the right canonical name:"
        ]
        for name in names[:20]:
            suggestions = difflib.get_close_matches(name, self._canonical, n=3, cutoff=0.6)
            hint = f"  (did you mean: {', '.join(suggestions)}?)" if suggestions else ""
            lines.append(f"  - {name!r}{hint}")
        if len(names) > 20:
            lines.append(f"  ... and {len(names) - 20} more")
        return "\n".join(lines)


def default_normaliser() -> TeamNameNormaliser:
    """The project's normaliser, built from configs/team_aliases.yaml."""
    return TeamNameNormaliser.from_file()
