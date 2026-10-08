"""Movies and TV from Netflix's official Top 10 (weekly, per country).

Source: https://www.netflix.com/tudum/top10 (the all-weeks-countries.tsv download).
Writes public/data/movies.json and public/data/tv.json with three ranges:
  week  - the latest week's Top 10
  month - the last 4 weeks combined (each week a title earns 11 - rank points)
  year  - the last 52 weeks combined, same scoring
Netflix publishes weekly only, so there is no day range.

Usage: python pipeline/netflix.py [--tsv path/to/local.tsv]
"""

from __future__ import annotations

import argparse
import csv
import io
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from common import CACHE_DIR, aggregate, http_get, span_label, write_category

TSV_URL = "https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv"
SOURCE = {"name": "Netflix Top 10", "url": "https://www.netflix.com/tudum/top10"}
CATEGORIES = {"Films": "movies", "TV": "tv"}
MONTH_WEEKS = 4
YEAR_WEEKS = 52


def load_rows(tsv_text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(tsv_text), delimiter="\t"))


def _season(row: dict) -> str | None:
    """'Wednesday: Season 2' -> 'Season 2'. None when Netflix says N/A."""
    season = (row.get("season_title") or "").strip()
    if not season or season == "N/A":
        return None
    show = row["show_title"].strip()
    return season[len(show) + 2 :] if season.startswith(show + ": ") else season


def build(rows: list[dict], netflix_category: str) -> tuple[list[dict], dict]:
    rows = [r for r in rows if r["category"] == netflix_category]
    weeks = sorted({r["week"] for r in rows}, reverse=True)

    # One Top 10 snapshot per week. The season is part of an entry's identity
    # (so "Season 1" and "Season 2" rank separately); weeks-in-Top-10 is only
    # shown on the single-week view.
    snapshots: dict[str, dict[str, list]] = {w: defaultdict(list) for w in weeks}
    latest_detail: dict[tuple, str] = {}
    for r in rows:
        name, season = r["show_title"].strip(), _season(r)
        entry = {"rank": int(r["weekly_rank"]), "name": name, **({"detail": season} if season else {})}
        snapshots[r["week"]][r["country_iso2"]].append(entry)
        if r["week"] == weeks[0]:
            weeks_in = int(r["cumulative_weeks_in_top_10"] or 0)
            streak = f"{weeks_in} wk in Top 10" if weeks_in > 1 else "New this week"
            latest_detail[(r["country_iso2"], name, season)] = " · ".join(d for d in (season, streak) if d)

    week = aggregate([snapshots[weeks[0]]])
    for iso2, entries in week.items():
        for e in entries:
            e["detail"] = latest_detail.get((iso2, e["name"], e.get("detail")), e.get("detail", ""))

    ranges, data = [], {}
    for range_id, label, n in (("week", "Week", 1), ("month", "Month", MONTH_WEEKS), ("year", "Year", YEAR_WEEKS)):
        window = weeks[:n]
        # Netflix weeks run Monday-Sunday and are keyed by their Sunday.
        start = date.fromisoformat(window[-1]) - timedelta(days=6)
        ranges.append({"id": range_id, "label": label, "note": span_label(start, date.fromisoformat(window[0]))})
        data[range_id] = week if n == 1 else aggregate([snapshots[w] for w in window])
    return ranges, data


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
