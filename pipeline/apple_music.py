"""Music from Apple Music's public "Top Songs" feeds (daily snapshot, per storefront).

Source: https://rss.marketingtools.apple.com (no key needed).
Writes public/data/music.json with one range, "today".

Usage: python pipeline/apple_music.py
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from common import NotFound, http_get, write_category
from iso2 import ALL_ISO2

FEED_URL = "https://rss.marketingtools.apple.com/api/v2/{cc}/music/most-played/10/songs.json"
SOURCE = {"name": "Apple Music Top Songs", "url": "https://music.apple.com"}
WORKERS = 6


def parse_feed(body: dict) -> list[dict]:
    entries = []
    for i, song in enumerate(body.get("feed", {}).get("results", [])[:10], start=1):
        entry = {"rank": i, "name": song.get("name", "").strip(), "detail": song.get("artistName", "").strip()}
        # Artwork only for #1, which is the only row that shows an image.
        if i == 1 and song.get("artworkUrl100"):
            entry["image"] = song["artworkUrl100"].replace("100x100bb", "200x200bb")
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


def main() -> int:
    today = fetch_all(ALL_ISO2)
    missing = [c for c in ALL_ISO2 if c not in today]
    print(f"Pass 1: {len(today)} countries; retrying {len(missing)} after a pause")
    time.sleep(20)
    today.update(fetch_all(missing))
    today = dict(sorted(today.items()))
    if not today:
        print("No feeds fetched; leaving the existing file alone.", file=sys.stderr)
        return 1
    write_category("music", SOURCE, [{"id": "today", "label": "Today"}], {"today": today})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
