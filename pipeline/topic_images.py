"""Find an image for each Trends topic and save topic_images.json.

Food: the Wikipedia article's lead image, but only when it lives on Wikimedia
Commons (free licenses). Images uploaded to English Wikipedia itself are often
non-free (posters, cover art, logos) and are skipped. Each image keeps an
attribution line, which the site shows under the picture.

Games get trailer thumbnails from youtube.py instead: their Wikipedia images are
almost always non-free cover art.

Already-found images are kept; delete an entry from topic_images.json to redo it.

Usage: python pipeline/topic_images.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

from common import NotFound, http_get

TOPICS = json.loads(Path(__file__).with_name("trends_topics.json").read_text(encoding="utf-8"))
OUT = Path(__file__).with_name("topic_images.json")
WIKI_CATEGORIES = ["foods"]
# Topic name -> Wikipedia article title, where they differ.
ARTICLE = {"Hot pot": "Hot pot", "Pad thai": "Pad thai"}
WIDTH = 960

SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
COMMONS_URL = (
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
    "&iiprop=url|extmetadata&iiurlwidth={width}&titles=File:{file}"
)


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


def commons_file(name: str) -> str | None:
    """File name of the article's lead image, if it is hosted on Commons."""
    title = urllib.parse.quote(ARTICLE.get(name, name).replace(" ", "_"))
    summary = json.loads(http_get(SUMMARY_URL.format(title=title)))
    src = (summary.get("originalimage") or {}).get("source", "")
    if "/wikipedia/commons/" not in src:
        return None
    path = urllib.parse.urlparse(src).path
    # .../commons/thumb/a/ab/File.jpg/3840px-File.jpg  or  .../commons/a/ab/File.jpg
    parts = path.split("/")
    name_part = parts[-2] if "/thumb/" in path else parts[-1]
    return urllib.parse.unquote(name_part)


def image_info(file: str) -> dict | None:
    url = COMMONS_URL.format(width=WIDTH, file=urllib.parse.quote(file))
    pages = json.loads(http_get(url))["query"]["pages"]
    info = next(iter(pages.values())).get("imageinfo", [None])[0]
    if not info:
        return None
    meta = info.get("extmetadata", {})
    artist = _plain(meta.get("Artist", {}).get("value", "")) or "Unknown author"
    license_name = _plain(meta.get("LicenseShortName", {}).get("value", "")) or "see Wikimedia Commons"
    return {
        "image": info.get("thumburl") or info["url"],
        "credit": f"Photo: {artist}, {license_name}, via Wikimedia Commons",
    }


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    out = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    for category in WIKI_CATEGORIES:
        found = out.setdefault(category, {})
        for topic in TOPICS[category]:
            name = topic["name"]
            if name in found:  # already looked up; delete the entry to redo it
                continue
            try:
                file = commons_file(name)
                pic = image_info(file) if file else None
            except NotFound:
                pic = None
            if pic:
                found[name] = pic
                print(f"{category:6} {name:16} {pic['credit']}")
            else:
                print(f"{category:6} {name:16} (no free image)")
            # Save after each lookup so a rate-limited run can resume.
            OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            time.sleep(2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
