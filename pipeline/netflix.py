"""Movies and TV from Netflix's official Top 10 (weekly, per country).

Source: https://www.netflix.com/tudum/top10 (the all-weeks-countries.tsv download).
Writes public/data/movies.json and public/data/tv.json with two ranges:
  week  - the latest week's Top 10
  month - the last 4 weeks combined (each week a title earns 11 - rank points)

Usage: python pipeline/netflix.py [--tsv path/to/local.tsv]
"""

from __future__ import annotations

import argparse
import csv
import io
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from common import CACHE_DIR, http_get, write_category

TSV_URL = "https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv"
SOURCE = {"name": "Netflix Top 10", "url": "https://www.netflix.com/tudum/top10"}
CATEGORIES = {"Films": "movies", "TV": "tv"}
MONTH_WEEKS = 4


def load_rows(tsv_text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(tsv_text), delimiter="\t"))


def _season(row: dict) -> str | None:
    """'Wednesday: Season 2' -> 'Season 2'. None when Netflix says N/A."""
    season = (row.get("season_title") or "").strip()
    if not season or season == "N/A":
        return None
    show = row["show_title"].strip()
    return season[len(show) + 2 :] if season.startswith(show + ": ") else season


def _span_label(first_week_end: str, last_week_end: str) -> str:
    """Netflix weeks run Monday-Sunday and are keyed by their Sunday."""
    start = date.fromisoformat(first_week_end) - timedelta(days=6)
    end = date.fromisoformat(last_week_end)
    return f"{start:%b} {start.day} – {end:%b} {end.day}"


def build(rows: list[dict], netflix_category: str) -> tuple[list[dict], dict]:
    rows = [r for r in rows if r["category"] == netflix_category]
    weeks = sorted({r["week"] for r in rows}, reverse=True)
    latest, month_weeks = weeks[0], set(weeks[:MONTH_WEEKS])

    week: dict[str, list] = defaultdict(list)
    points: dict[str, dict[tuple, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        iso2, rank = r["country_iso2"], int(r["weekly_rank"])
        key = (r["show_title"].strip(), _season(r))
        if r["week"] == latest:
            weeks_in = int(r["cumulative_weeks_in_top_10"] or 0)
            entry = {"rank": rank, "name": key[0]}
            detail = [d for d in (key[1], f"{weeks_in} wk in Top 10" if weeks_in > 1 else "New this week") if d]
            entry["detail"] = " · ".join(detail)
            week[iso2].append(entry)
        if r["week"] in month_weeks:
            points[iso2][key] += 11 - rank

    for entries in week.values():
        entries.sort(key=lambda e: e["rank"])

    month = {}
    for iso2, scored in points.items():
        top = sorted(scored.items(), key=lambda kv: (-kv[1], kv[0][0]))[:10]
        month[iso2] = [
            {"rank": i, "name": name, **({"detail": season} if season else {})}
            for i, ((name, season), _) in enumerate(top, start=1)
        ]

    ranges = [
        {"id": "week", "label": "Week", "note": _span_label(latest, latest)},
        {"id": "month", "label": "4 weeks", "note": _span_label(min(month_weeks), latest)},
    ]
    return ranges, {"week": dict(week), "month": month}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--tsv", type=Path, help="use a local TSV instead of downloading")
    args = parser.parse_args(argv)

    if args.tsv:
        text = args.tsv.read_text(encoding="utf-8")
    else:
        text = http_get(TSV_URL, timeout=180).decode("utf-8")
        CACHE_DIR.mkdir(exist_ok=True)
        (CACHE_DIR / "netflix.tsv").write_text(text, encoding="utf-8")

    rows = load_rows(text)
    for netflix_category, category in CATEGORIES.items():
        ranges, data = build(rows, netflix_category)
        write_category(category, SOURCE, ranges, data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
