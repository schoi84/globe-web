"""Shared helpers: HTTP with retries and the category file writer.

Every category is written to public/data/<id>.json in one shape:

    {
      "generatedAt": "ISO-8601",
      "source": {"name": "...", "url": "..."},
      "ranges": [{"id": "week", "label": "This week", "note": "Sep 28 - Oct 4"}],
      "data": {"week": {"KR": [{"rank": 1, "name": "...", "detail": "...", "image": "..."}]}}
    }

The frontend only reads these files.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
USER_AGENT = "world-charts-pipeline/1.0 (+hobby project)"


class NotFound(Exception):
    pass


def http_get(url: str, retries: int = 4, timeout: int = 60) -> bytes:
    """GET with retries on rate limits, server errors and network hiccups."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise NotFound(url) from e
            if e.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError("unreachable")


def write_category(category: str, source: dict, ranges: list[dict], data: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{category}.json"
    body = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "ranges": ranges,
        "data": data,
    }
    path.write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    countries = len(next(iter(data.values()), {}))
    print(f"Wrote {path.relative_to(ROOT)} ({countries} countries, {len(ranges)} ranges)")
    return path
