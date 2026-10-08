"""Official trailers from YouTube for Movies, TV and Games.

Reads public/data/{movies,tv,games}.json, finds a trailer per title with the
YouTube Data API, and writes the video ID back onto every matching entry
("video"). The site shows its thumbnail and links to it on YouTube, as the
YouTube API terms require.

Each search costs 100 of the 10,000 free daily quota units, so a run looks up at
most --budget new titles (default 90), most widespread first. Results, including
"no trailer found", are cached in youtube_videos.json (committed), so a title is
never searched twice and the backlog fills over a few days of scheduled runs.

Needs YOUTUBE_API_KEY (see .env.example). Without it, cached videos are still
attached and nothing is searched.

Usage: python pipeline/youtube.py [--budget 90]
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from collections import Counter
from pathlib import Path

from common import OUT_DIR, env, http_get

CACHE_FILE = Path(__file__).with_name("youtube_videos.json")
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
# What to search for, per category. Netflix posts trailers for its own titles.
QUERY = {
    "movies": "{name} Netflix official trailer",
    "tv": "{name} Netflix official trailer",
    "games": "{name} official game trailer",
}
# Fan edits, concept trailers and commentary are not the official trailer.
UNOFFICIAL = ("concept", "fan made", "fanmade", "fan-made", "predictor", "reaction", "explained", "review", "parody", "notflix")
SOURCE = {"name": "YouTube", "url": "https://www.youtube.com", "label": "Trailers"}
# Games only show a trailer from an official channel: the game's own, or its
# publisher's. Anything else (IGN, GameSpot, fan uploads) falls back to the
# store image from topic_images.json, or to no image at all.
GAME_PUBLISHERS = (
    # Multi-word or distinctive names only: short words like "king" would match fan channels.
    "rockstar games", "riot games", "supercell", "activision", "electronic arts", "ea sports",
    "garena", "moonton", "tencent games", "hoyoverse", "niantic", "the pokémon company",
    "krafton", "valve", "dota2", "respawn", "mojang", "epic games", "playstation", "xbox", "nintendo",
)
TOPIC_IMAGES = Path(__file__).with_name("topic_images.json")


def official_game_channel(channel: str, name: str) -> bool:
    channel = channel.casefold()
    game = name.casefold().split(":")[0]  # "PUBG: Battlegrounds" -> "pubg"
    return game in channel or any(p in channel for p in GAME_PUBLISHERS)


def score(item: dict, category: str, name: str) -> int:
    """Rank search results: official channels and "official trailer" titles first."""
    title = item["snippet"]["title"].casefold()
    channel = item["snippet"]["channelTitle"].casefold()
    points = 0
    if category in ("movies", "tv") and "netflix" in channel:
        points += 4
    if category == "games" and name.casefold().split(":")[0] in channel:
        points += 4  # the game's own channel, e.g. "Brawl Stars"
    if "trailer" in title:
        points += 2
    if "official" in title:
        points += 1
    if name.casefold() in title:
        points += 1
    if any(word in title or word in channel for word in UNOFFICIAL):
        points -= 6
    return points


def search(key: str, query: str, category: str, name: str) -> dict | None:
    params = {
        "part": "snippet",
        "type": "video",
        "maxResults": 8,  # same quota cost as 1
        "q": query,
        "videoEmbeddable": "true",
        "safeSearch": "strict",
        "key": key,
    }
    items = json.loads(http_get(f"{SEARCH_URL}?{urllib.parse.urlencode(params)}")).get("items", [])
    # Stable sort keeps YouTube's relevance order among equally scored results.
    ranked = sorted(items, key=lambda i: -score(i, category, name))
    if not ranked or score(ranked[0], category, name) < 0:
        return None
    best = ranked[0]
    return {"id": best["id"]["videoId"], "channel": best["snippet"]["channelTitle"]}


def importance(data: dict) -> Counter:
    """How visible each title is: 11 - rank points for every country and range it appears in."""
    score: Counter = Counter()
    for by_country in data.values():
        for entries in by_country.values():
            for e in entries:
                score[e["name"]] += 11 - e["rank"]
    return score


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--budget", type=int, default=90, help="max new searches this run")
    args = parser.parse_args(argv)

    key = env("YOUTUBE_API_KEY")
    if not key:
        print("YOUTUBE_API_KEY not set; attaching cached trailers only.", file=sys.stderr)
    cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
    files = {c: OUT_DIR / f"{c}.json" for c in QUERY if (OUT_DIR / f"{c}.json").exists()}
    bodies = {c: json.loads(p.read_text(encoding="utf-8")) for c, p in files.items()}

    # One shared queue across categories, most visible titles first.
    queue = []
    for category, body in bodies.items():
        known = cache.setdefault(category, {})
        for name, score in importance(body["data"]).items():
            if name not in known:
                queue.append((score, category, name))
    queue.sort(reverse=True)
    print(f"{len(queue)} titles without a trailer lookup; searching up to {args.budget if key else 0}")

    budget = args.budget if key else 0
    for _, category, name in queue[:budget]:
        try:
            cache[category][name] = search(key, QUERY[category].format(name=name), category, name)
        except Exception as e:  # quota exhausted or network trouble: keep what we have
            print(f"Stopped at {name!r}: {e}", file=sys.stderr)
            break
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    store_images = json.loads(TOPIC_IMAGES.read_text(encoding="utf-8")).get("games", {}) if TOPIC_IMAGES.exists() else {}
    for category, body in bodies.items():
        found = 0
        for by_country in body["data"].values():
            for entries in by_country.values():
                for e in entries:
                    video = cache.get(category, {}).get(e["name"])
                    if category == "games":
                        # Official trailer, else the store image, else nothing.
                        for k in ("video", "image", "credit"):
                            e.pop(k, None)
                        if video and official_game_channel(video["channel"], e["name"]):
                            e["video"] = video["id"]
                            e["credit"] = f"Trailer: {video['channel']} on YouTube"
                            found += 1
                        elif e["name"] in store_images:
                            e.update(store_images[e["name"]])
                        continue
                    if video:
                        e["video"] = video["id"]
                        e["credit"] = f"Trailer: {video['channel']} on YouTube"
                        found += 1
                    else:  # cleared or not found: drop any trailer from an earlier run
                        e.pop("video", None)
                        e.pop("credit", None)
        if found:
            body["imageSource"] = SOURCE
        files[category].write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{category}: trailers on {found} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
