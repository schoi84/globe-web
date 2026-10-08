"""Resolve candidate names to Google Trends topic IDs and save trends_topics.json.

Topics (not plain search strings) make the comparison language-independent: the
"Soccer" topic counts searches for fútbol, 축구, サッカー and so on. Run this once
after editing CANDIDATES, then review the file: a wrong match (e.g. the insect for
"cricket") silently ruins a category.

Usage: python pipeline/resolve_topics.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from pytrends.request import TrendReq

from trends_common import with_backoff

OUT = Path(__file__).with_name("trends_topics.json")

# category -> [(search query, exact topic title)], anchor first. Matching the exact
# title avoids look-alikes ("Fried chicken" -> KFC, "Grand Theft Auto V" -> VI).
# A third element pins a topic ID that search doesn't surface.
CANDIDATES: dict[str, list[tuple]] = {
    "foods": [
        ("Pizza", "Pizza"),
        ("Sushi", "Sushi"),
        ("Hamburger", "Hamburger"),
        ("Pasta", "Pasta"),
        ("Ramen", "Ramen"),
        ("Taco", "Taco"),
        ("Fried chicken", "Fried chicken"),
        ("Curry", "Curry"),
        ("Dumpling", "Dumpling"),
        ("Phở", "Pho"),
        ("Biryani", "Biryani"),
        ("Kebab", "Kebab"),
        ("Paella", "Paella"),
        ("Hot pot", "Hot pot"),
        ("Pad thai", "Pad thai"),
        ("Burrito", "Burrito"),
        ("Falafel", "Falafel"),
        ("Shawarma", "Shawarma"),
        ("Fried rice", "Fried rice"),
        ("Kimchi", "Kimchi"),
    ],
    "games": [
        ("Minecraft", "Minecraft"),
        ("Fortnite", "Fortnite"),
        ("Roblox", "Roblox"),
        ("GTA 5", "Grand Theft Auto V"),
        ("League of Legends", "League of Legends"),
        ("Valorant", "Valorant"),
        ("Counter-Strike 2", "Counter-Strike 2"),
        ("PUBG: Battlegrounds", "PUBG: Battlegrounds"),
        ("Free Fire", "Free Fire"),
        ("Mobile Legends", "Mobile Legends: Bang Bang"),
        ("Genshin Impact", "Genshin Impact"),
        ("Call of Duty: Warzone", "Call of Duty: Warzone"),
        ("EA Sports FC", "EA Sports FC"),
        ("Pokemon Go", "Pokémon GO"),
        ("Clash of Clans", "Clash of Clans"),
        ("Brawl Stars", "Brawl Stars"),
        ("Apex Legends", "Apex Legends"),
        ("Dota 2", "Dota 2"),
        ("Honor of Kings", "Honor of Kings"),
        ("Candy Crush Saga", "Candy Crush Saga"),
    ],
}


def resolve(trends: TrendReq, query: str, title: str, mid: str | None = None) -> dict | None:
    if mid:
        return {"name": title, "mid": mid}
    for s in with_backoff(lambda: trends.suggestions(query)):
        if s.get("title", "").casefold() == title.casefold():
            return {"name": title, "mid": s["mid"]}
    return None


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to a legacy codepage
    trends = TrendReq(hl="en-US", tz=0, timeout=(10, 30))
    out: dict[str, list[dict]] = {}
    for category, items in CANDIDATES.items():
        out[category] = []
        for query, title, *pinned in items:
            hit = resolve(trends, query, title, *pinned)
            if hit:
                out[category].append(hit)
                print(f"{category:7} {title:28} -> {hit['mid']}")
            else:
                print(f"{category:7} {title:28} -> NOT FOUND, dropped")
            time.sleep(3)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
