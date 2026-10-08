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
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
USER_AGENT = "world-charts-pipeline/1.0 (https://github.com/schoi84/globe-web)"


class NotFound(Exception):
    pass


def env(name: str) -> str | None:
    """A setting from the environment (GitHub Actions secrets) or pipeline/.env (local, gitignored)."""
    if name in os.environ:
        return os.environ[name] or None
    path = Path(__file__).with_name(".env")
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name and not key.strip().startswith("#"):
                return value.strip().strip("\"'") or None
    return None


def http_get(
    url: str,
    retries: int = 4,
    timeout: int = 60,
    headers: dict | None = None,
    data: bytes | None = None,
) -> bytes:
    """GET (or POST, when data is given) with retries on rate limits, server errors
    and network hiccups."""
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
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


def aggregate(snapshots: list[dict[str, list[dict]]], top: int = 10) -> dict[str, list[dict]]:
    """Merge several per-country Top 10 snapshots (newest first) into one ranking.

    Each appearance earns 11 - rank points; ties break by name. Entries are
    identified by (name, detail), and each entry keeps its newest image.
    """
    points: dict[str, dict[tuple, int]] = {}
    images: dict[tuple, str] = {}
    for snapshot in snapshots:
        for iso2, entries in snapshot.items():
            country = points.setdefault(iso2, {})
            for e in entries:
                key = (e["name"], e.get("detail"))
                country[key] = country.get(key, 0) + 11 - e["rank"]
                if e.get("image"):
                    images.setdefault(key, e["image"])

    out = {}
    for iso2, scored in sorted(points.items()):
        ranked = sorted(scored.items(), key=lambda kv: (-kv[1], kv[0][0]))[:top]
        out[iso2] = [
            {
                "rank": i,
                "name": name,
                **({"detail": detail} if detail else {}),
                **({"image": images[(name, detail)]} if (name, detail) in images else {}),
            }
            for i, ((name, detail), _) in enumerate(ranked, start=1)
        ]
    return out


def span_label(start: date, end: date) -> str:
    if start == end:
        return f"{end:%b} {end.day}, {end.year}"
    if start.year != end.year:
        return f"{start:%b} {start.day}, {start.year} – {end:%b} {end.day}, {end.year}"
    return f"{start:%b} {start.day} – {end:%b} {end.day}"


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
