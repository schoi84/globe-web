"""Music from Apple Music's public "Top Songs" feeds (daily snapshot, per storefront).

Source: https://rss.marketingtools.apple.com (no key needed).
Saves today's chart to data/history/music/<date>.json, then writes public/data/music.json:
  day - today's chart
  week / month / year - the saved days in that window combined (11 - rank points
  per day). Each appears once there's more history than the range before it.

Usage: python pipeline/apple_music.py [--rebuild]
"""

from __future__ import annotations

import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

from common import ROOT, NotFound, aggregate, http_get, span_label, write_category
from iso2 import ALL_ISO2

FEED_URL = "https://rss.marketingtools.apple.com/api/v2/{cc}/music/most-played/10/songs.json"
SOURCE = {"name": "Apple Music Top Songs", "url": "https://music.apple.com"}
WORKERS = 6
# One file per day; committed by the scheduled job so Week/Month/Year can build up.
HISTORY_DIR = ROOT / "data" / "history" / "music"


def parse_feed(body: dict) -> list[dict]:
    entries = []
    for i, song in enumerate(body.get("feed", {}).get("results", [])[:10], start=1):
        entry = {"rank": i, "name": song.get("name", "").strip(), "detail": song.get("artistName", "").strip()}
        # Every row can expand to show its artwork; #1 also uses it as the hero.
        if song.get("artworkUrl100"):
            entry["image"] = song["artworkUrl100"].replace("100x100bb", "600x600bb")
        entries.append(entry)
    return entries


def fetch_country(iso2: str) -> tuple[str, list[dict] | None]:
    # Countries without a storefront answer 500, same as a flaky real one, so keep
    # each attempt cheap and let the second pass in main() catch transient failures.
    try:
        body = json.loads(http_get(FEED_URL.format(cc=iso2.lower()), retries=1, timeout=15))
    except NotFound:
        return iso2, None
    except Exception:
        return iso2, None
    entries = parse_feed(body)
    return iso2, entries or None


def fetch_all(codes) -> dict[str, list[dict]]:
    with ThreadPoolExecutor(WORKERS) as pool:
        return {iso2: entries for iso2, entries in pool.map(fetch_country, codes) if entries}


def load_history(today: date) -> list[tuple[date, dict]]:
    """Saved daily snapshots from the last year, newest first."""
    out = []
    for path in HISTORY_DIR.glob("*.json"):
        day = date.fromisoformat(path.stem)
        if today - day < timedelta(days=365):
            out.append((day, json.loads(path.read_text(encoding="utf-8"))))
    return sorted(out, key=lambda x: x[0], reverse=True)


def build_ranges(history: list[tuple[date, dict]]) -> tuple[list[dict], dict]:
    """Day is the newest snapshot. Week/Month/Year combine the snapshots in their
    window, and only appear once the window holds more days than the range before it."""
    newest = history[0][0]
    ranges = [{"id": "day", "label": "Day", "note": span_label(newest, newest)}]
    data = {"day": history[0][1]}
    shown_days = 1
    for range_id, label, days in (("week", "Week", 7), ("month", "Month", 30), ("year", "Year", 365)):
        window = [(d, snap) for d, snap in history if newest - d < timedelta(days=days)]
        if len(window) <= shown_days:
            break
        note = span_label(window[-1][0], newest)
        if len(window) < days:
            note += f" · {len(window)} days so far"
        ranges.append({"id": range_id, "label": label, "note": note})
        data[range_id] = aggregate([snap for _, snap in window])
        shown_days = len(window)
    return ranges, data


def main(argv: list[str]) -> int:
    if "--rebuild" in argv:  # regenerate music.json from saved history, no fetching
        history = load_history(datetime.now(timezone.utc).date())
        if not history:
            print("No saved history to rebuild from.", file=sys.stderr)
            return 1
        write_category("music", SOURCE, *build_ranges(history))
        return 0

    today_data = fetch_all(ALL_ISO2)
    missing = [c for c in ALL_ISO2 if c not in today_data]
    print(f"Pass 1: {len(today_data)} countries; retrying {len(missing)} after a pause")
    time.sleep(20)
    today_data.update(fetch_all(missing))
    if not today_data:
        print("No feeds fetched; leaving the existing files alone.", file=sys.stderr)
        return 1

    today = datetime.now(timezone.utc).date()
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    (HISTORY_DIR / f"{today.isoformat()}.json").write_text(
        json.dumps(dict(sorted(today_data.items())), ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    ranges, data = build_ranges(load_history(today))
    write_category("music", SOURCE, ranges, data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
