"""Charts for the evaluation results (matplotlib, static PNGs).

Every chart is drawn twice, for a light and a dark background, so the README
can show the right one for the reader's theme. Colours come from a validated,
colour-blind-safe palette; its first three slots are used, the most that
palette clears for scatter-style charts. Text is always drawn in ink colours,
never in a series colour.

Calibration charts are small multiples (one panel per outcome) rather than
three overlapping series, and the number of forecasts in each bin gets its
own panel underneath instead of a second y-axis.
"""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Sequence

import matplotlib

try:  # inside Jupyter, leave the backend alone so charts display inline
    get_ipython  # type: ignore[name-defined]  # noqa: B018
except NameError:
    matplotlib.use("Agg")  # scripts and the CLI only write files
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from .calibration import expected_calibration_error  # noqa: E402

THEMES: dict[str, dict[str, str]] = {
    "light": {
        "surface": "#fcfcfb",
        "ink": "#0b0b0b",
        "ink_secondary": "#52514e",
        "muted": "#898781",
        "grid": "#e1e0d9",
        "axis": "#c3c2b7",
    },
    "dark": {
        "surface": "#1a1a19",
        "ink": "#ffffff",
        "ink_secondary": "#c3c2b7",
        "muted": "#898781",
        "grid": "#2c2c2a",
        "axis": "#383835",
    },
}

#: Categorical slots 1-3 (blue, orange, aqua), stepped per mode.
SERIES: dict[str, tuple[str, ...]] = {
    "light": ("#2a78d6", "#eb6834", "#1baf7a"),
    "dark": ("#3987e5", "#d95926", "#199e70"),
}

_FONT = ["Segoe UI", "Helvetica Neue", "Arial", "DejaVu Sans"]


def _style(ax, theme: str) -> None:
    colours = THEMES[theme]
    ax.set_facecolor(colours["surface"])
    ax.grid(True, color=colours["grid"], linewidth=0.8, linestyle="-")
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(colours["axis"])
        ax.spines[side].set_linewidth(0.8)
    ax.tick_params(colors=colours["muted"], labelcolor=colours["ink_secondary"], labelsize=9, length=0)
    ax.xaxis.label.set_color(colours["ink_secondary"])
    ax.yaxis.label.set_color(colours["ink_secondary"])


def _figure(theme: str, **kwargs):
    plt.rcParams["font.family"] = "sans-serif"
    plt.rcParams["font.sans-serif"] = _FONT
    fig, axes = plt.subplots(**kwargs)
    fig.patch.set_facecolor(THEMES[theme]["surface"])
    return fig, axes


def plot_calibration(
    tables: Mapping[str, pd.DataFrame],
    *,
    title: str,
    subtitle: str = "",
    theme: str = "light",
    colours: Sequence[str] | None = None,
) -> plt.Figure:
    """Reliability diagrams, one column per table, with bin counts underneath.

    Each point is a bin of forecasts: x = their average forecast probability,
    y = how often the event happened, with a 95% interval. On the diagonal
    means well calibrated; below it means over-confident in that range.
    """
    palette = list(colours or SERIES[theme])
    ink = THEMES[theme]
    n = len(tables)
    width = max(5.8, 4.2 * n)
    fig, axes = _figure(
        theme,
        nrows=2,
        ncols=n,
        figsize=(width, 5.4),
        gridspec_kw={"height_ratios": [3.2, 1], "hspace": 0.12, "wspace": 0.28},
        squeeze=False,
    )
    for column, (name, table) in enumerate(tables.items()):
        colour = palette[column % len(palette)]
        top, bottom = axes[0, column], axes[1, column]
        _style(top, theme)
        _style(bottom, theme)

        top.plot([0, 1], [0, 1], color=ink["muted"], linewidth=1, zorder=1)
        top.vlines(table["mean_forecast"], table["ci_low"], table["ci_high"], color=colour, alpha=0.45, linewidth=1.5, zorder=2)
        top.plot(
            table["mean_forecast"], table["observed"], linestyle="-", linewidth=2, color=colour,
            marker="o", markersize=7, markeredgecolor=ink["surface"], markeredgewidth=1.5,
            solid_capstyle="round", zorder=3, clip_on=False,
        )
        top.set_xlim(0, 1)
        top.set_ylim(0, 1)
        top.set_xticklabels([])
        top.set_title(name, loc="left", fontsize=10.5, color=ink["ink"], pad=20)
        top.text(
            0, 1.025, f"average gap from the diagonal: {100 * expected_calibration_error(table):.1f} pts",
            transform=top.transAxes, fontsize=9, color=ink["ink_secondary"], va="bottom",
        )
        if column == 0:
            top.set_ylabel("how often it happened")

        bar_width = 0.6 * np.diff(np.r_[0, np.sort(table["mean_forecast"].to_numpy())]).clip(0.01, 0.06).min()
        bottom.bar(table["mean_forecast"], table["n"], width=max(bar_width, 0.012), color=ink["muted"], alpha=0.55, linewidth=0)
        bottom.set_xlim(0, 1)
        bottom.set_xlabel("forecast probability")
        bottom.yaxis.set_major_locator(matplotlib.ticker.MaxNLocator(3, integer=True))
        bottom.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{int(v):,}"))
        if column == 0:
            bottom.set_ylabel("forecasts")
        for ax in (top, bottom):
            ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
        top.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))

    fig.suptitle(title, x=0.012, ha="left", y=0.995, fontsize=13, color=ink["ink"], fontweight="semibold")
    if subtitle:
        fig.text(0.012, 0.94, subtitle, ha="left", fontsize=9.5, color=ink["ink_secondary"])
    # Margins in inches, converted to figure fractions, so tick labels have the
    # same room whether the figure holds one panel or three.
    fig.subplots_adjust(top=0.80, left=0.85 / width, right=1 - 0.35 / width, bottom=0.11)
    return fig


def plot_zone_probabilities(
    summary: pd.DataFrame,
    zone: str,
    *,
    title: str,
    theme: str = "light",
    top: int | None = None,
) -> plt.Figure:
    """Horizontal bars of one zone's probability per team, largest first.

    A single series, so no legend: the title names it. Values are labelled at
    the bar ends because a reader wants the number, and there are few bars.
    """
    ink = THEMES[theme]
    colour = SERIES[theme][0]
    data = summary[zone].sort_values(ascending=True)
    data = data[data > 0]
    if top:
        data = data.tail(top)
    fig, ax = _figure(theme, figsize=(7.2, 0.34 * len(data) + 1.2))
    _style(ax, theme)
    ax.grid(False, axis="y")
    ax.barh(data.index, data.values, height=0.62, color=colour, linewidth=0)
    for y, value in enumerate(data.values):
        label = "<0.1%" if value < 0.001 else f"{100 * value:.1f}%"
        ax.text(value + 0.01, y, label, va="center", fontsize=9, color=ink["ink_secondary"])
    ax.set_xlim(0, min(1.0, data.max() * 1.18 + 0.02))
    ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0, decimals=0))
    ax.tick_params(axis="y", labelcolor=ink["ink"], labelsize=9.5)
    ax.set_title(title, loc="left", fontsize=12, color=ink["ink"], fontweight="semibold", pad=10)
    fig.tight_layout()
    return fig


def save_themed(make_figure, path_stem: str | Path) -> list[Path]:
    """Render ``make_figure(theme)`` for both themes; write ``<stem>-light.png`` and ``-dark.png``."""
    stem = Path(path_stem)
    stem.parent.mkdir(parents=True, exist_ok=True)
    written = []
    for theme in ("light", "dark"):
        fig = make_figure(theme)
        path = stem.with_name(f"{stem.name}-{theme}.png")
        fig.savefig(path, dpi=150, facecolor=fig.get_facecolor())
        plt.close(fig)
        written.append(path)
    return written
