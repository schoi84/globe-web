"""Food and games from Google Trends (per-country search interest in topics).

Trends compares at most 5 terms per request and scales each request on its own, so
every batch is [anchor, 4 others] and each score is divided by the anchor's score
in that country. That puts all batches on one scale and lets us rank ~20 topics
per country. A country is dropped from a batch if the anchor scored 0 there (no
common scale), and kept only if at least MIN_ITEMS topics have any interest.

Topics come from trends_topics.json (see resolve_topics.py). Raw batch results are
cached per day in .cache/trends/ so a run cut short by rate limits can resume.

Usage: python pipeline/trends.py [foods] [games]
"""

from __future__ import annotations

import json
import sys
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

from pytrends.request import TrendReq

from common import CACHE_DIR, write_category
from trends_common import with_backoff

TOPICS = json.loads(Path(__file__).with_name("trends_topics.json").read_text(encoding="utf-8"))
SOURCE = {"name": "Google Trends", "url": "https://trends.google.com"}
RANGES = [
    {"id": "month", "label": "Month", "note": "Past 30 days", "timeframe": "today 1-m"},
    {"id": "year", "label": "Year", "note": "Past 12 months", "timeframe": "today 12-m"},
]
BATCH = 4  # plus the anchor = Trends' 5-term limit
MIN_ITEMS = 3
PAUSE = 8  # seconds between live requests


def fetch_batch(trends: TrendReq, mids: list[str], timeframe: str, cache: Path) -> dict[str, dict[str, int]]:
    """{ISO2: {mid: interest}} for one request, from cache when available."""
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))

    def call():
        trends.build_payload(mids, timeframe=timeframe)
        return trends.interest_by_region(resolution="COUNTRY", inc_low_vol=True, inc_geo_code=True)

    df = with_backoff(call)
    result = {
        row["geoCode"]: {mid: int(row[mid]) for mid in mids}
        for _, row in df.iterrows()
        if row.get("geoCode")
    }
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result), encoding="utf-8")
    time.sleep(PAUSE)
    return result


def rank(topics: list[dict], batches: list[dict[str, dict[str, int]]]) -> dict[str, list[dict]]:
    anchor = topics[0]["mid"]
    names = {t["mid"]: t["name"] for t in topics}
    scores: dict[str, dict[str, float]] = defaultdict(dict)
    for batch in batches:
        for iso2, values in batch.items():
            base = values.get(anchor, 0)
            if base <= 0:
                continue
            for mid, v in values.items():
                scores[iso2][mid] = v / base

    out = {}
    for iso2, by_mid in scores.items():
        ranked = sorted(((s, mid) for mid, s in by_mid.items() if s > 0), key=lambda x: (-x[0], names[x[1]]))
        if len(ranked) < MIN_ITEMS:
            continue
        top = ranked[0][0]
        out[iso2] = [
            {"rank": i, "name": names[mid], **({"detail": f"{round(s / top * 100)}% of #1's interest"} if i > 1 else {})}
            for i, (s, mid) in enumerate(ranked[:10], start=1)
        ]
    return dict(sorted(out.items()))


def run_category(trends: TrendReq, category: str) -> None:
    topics = TOPICS[category]
    anchor, others = topics[0]["mid"], [t["mid"] for t in topics[1:]]
    chunks = [others[i : i + BATCH] for i in range(0, len(others), BATCH)]
    day_cache = CACHE_DIR / "trends" / date.today().isoformat()

    data = {}
    for r in RANGES:
        batches = []
        for i, chunk in enumerate(chunks):
            print(f"{category} {r['id']}: batch {i + 1}/{len(chunks)}")
            cache = day_cache / f"{category}-{r['id']}-{i}.json"
            batches.append(fetch_batch(trends, [anchor, *chunk], r["timeframe"], cache))
        data[r["id"]] = rank(topics, batches)

    ranges = [{k: v for k, v in r.items() if k != "timeframe"} for r in RANGES]
    write_category(category, SOURCE, ranges, data)


def main(argv: list[str]) -> int:
    categories = argv or list(TOPICS)
    unknown = [c for c in categories if c not in TOPICS]
    if unknown:
        print(f"Unknown categories: {unknown}. Choose from {list(TOPICS)}", file=sys.stderr)
        return 2
    trends = TrendReq(hl="en-US", tz=0, timeout=(10, 30))
    for category in categories:
        run_category(trends, category)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
