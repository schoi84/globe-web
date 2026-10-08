# World Charts: project brief

Portfolio project. An interactive 3D globe showing what's #1 in each country across categories: movies, TV, music, food, games. Click a country for its top 10. Supported by ads (Google AdSense).


## Data sources

| Category | Source | Key | Ranges | Script |
|---|---|---|---|---|
| Movies, TV | Netflix Top 10, `all-weeks-countries.tsv` (~93 countries) | none | `week`, `month` (4 wk), `year` (52 wk). No day: Netflix is weekly only | `pipeline/netflix.py` |
| Music | Apple Music "most-played" RSS feeds (~150 storefronts) | none | `day`; `week`/`month`/`year` built from saved daily history | `pipeline/apple_music.py` |
| Food, Games | Google Trends (pytrends), 20 topics each | none | `day`, `week`, `month`, `year` | `pipeline/trends.py` |

- Apple's feed answers **500** (not 404) for countries without a storefront and is flaky for real ones. `apple_music.py` does a fast first pass, then retries only the failures once (~7 min total).
- Multi-period views (Netflix month/year, Music week/month/year) merge snapshots with `common.aggregate`: 11 - rank points per appearance.
- **Music history:** each daily run saves `data/history/music/<date>.json` (committed). Week/Month/Year only appear once there are more days than the range before them; the note says "N days so far" until the window is full. `apple_music.py --rebuild` regenerates music.json from history without fetching.
- **Hero images** (#1 only): Music uses Apple album art (600px). Food uses Wikimedia Commons photos from `pipeline/topic_images.py` → `topic_images.json`, Commons only (free licenses), each with a `credit` line the UI must show. Movies, TV and Games have no image source yet (posters and cover art are copyrighted).
- The frontend shares one range choice across categories and falls back to the nearest range a category has (`pickRange` in `App.tsx`).
- **Trends method:** topics (not search strings) so it works across languages. Batches of [anchor + 4], scores divided by the anchor (Pizza, Minecraft) per country to share one scale. Countries need ≥3 topics with interest. Topic IDs live in `pipeline/trends_topics.json`; edit `CANDIDATES` in `resolve_topics.py` and re-run it, then **check the matches** (exact-title matching avoids look-alikes like KFC for "Fried chicken").
- Trends rate-limits hard (429). `trends_common.with_backoff` waits 60s, 120s, ... and raw batches are cached per day in `pipeline/.cache/trends/`, so a re-run resumes. `--ranges day,week` refreshes only those ranges and keeps the rest of the existing file.
- The games list is hand-picked; review it every few months.
- Show a source credit for each category (the legend has a "Data: ..." link).

## Data shape

Every category is one file, `public/data/<category>.json`. The frontend only reads these.

```json
{
  "generatedAt": "ISO-8601",
  "source": { "name": "Netflix Top 10", "url": "https://www.netflix.com/tudum/top10" },
  "ranges": [{ "id": "week", "label": "Week", "note": "Sep 28 – Oct 4" }],
  "data": { "week": { "KR": [{ "rank": 1, "name": "...", "detail": "...", "image": "..." }] } }
}
```

`detail` is the secondary line (artist, season, weeks in Top 10). `image` and `credit` are only set on #1 entries; with an image, the panel shows #1 as a hero card.

## Frontend

- Vite + React + TypeScript, Tailwind v4, **shadcn/ui** (`base-nova` style, built on Base UI, not Radix). Add components with `npx shadcn@latest add <name>`. App is forced dark (`class="dark"` on `<html>`).
- Globe: `react-globe.gl`, with polygons from `world-atlas` (Natural Earth 110m) tagged ISO alpha-2 via `i18n-iso-countries` (`src/countries.ts`).
- **Map coloring:** each country takes the color of its #1 item. Only the **3 most widespread #1s** get hues (`src/palette.ts`: `#3987e5`, `#d95926`, `#199e70`, validated all-pairs on the dark surface by the dataviz skill). Everything else is "Other" grey. Don't add more hues: choropleths fail colorblind checks past 3.
- `src/data.ts`: category list, cached per-category loader, `topItems()`. Data loads **on demand** for the open category (prefetched on tab hover/focus), never all at once.
- **Performance:** `world-globe.tsx` is `React.lazy` (three.js + map data in its own ~2 MB chunk; main bundle ~455 KB). Globe accessors only change with data/selection, never on hover (globe.gl re-evaluates every polygon when an accessor changes). The globe does not auto-rotate.
- **Mobile (<640px):** text category tabs, 44px touch targets, a legend chip (`LegendChip`) with the data credit, and the country panel as a bottom sheet (50dvh, drag the handle down to close). `GlobeInsets` shrinks the globe to the free area so the selected country stays visible.
- All four range buttons always show. If the open category lacks the chosen range, it falls back to the nearest one and `rangeGap()` explains why under the toggle.
- Shareable URLs: `?c=<category>&range=<range>&country=<ISO2>`. The country search (`country-search.tsx`) lists every ISO code, including places the 110m map doesn't draw.
- Components: `world-globe.tsx`, `country-panel.tsx`, `country-search.tsx`, `ad-slot.tsx`.
- Ads: `AdSlot` renders nothing until `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` are set (`.env.local`). It sits at the bottom of the country panel.

## Commands

- Dev: `npm run dev`. Build: `npm run build` (relative `base`, works on GitHub Pages).
- Data: `python pipeline/netflix.py`, `python pipeline/apple_music.py` (stdlib only), `python pipeline/trends.py` (needs `pip install -r pipeline/requirements.txt`). Python 3.10+.
- Tests: `cd pipeline && python -m unittest`.

## Milestones

1. ✅ Globe + panel + category and range toggles.
2. ✅ Netflix (movies, TV) and Apple Music pipelines with real data.
3. ✅ Trends job for food and games. (Sports was dropped: soccer was #1 almost everywhere.)
4. ✅ `.github/workflows/refresh-and-deploy.yml`: Apple Music + Trends day/week daily, Netflix + Trends month/year on Wednesdays, commit `public/data` and `data/history`, deploy to GitHub Pages. Trends may hit 429s from cloud IPs (step is `continue-on-error`, keeps the old files).
5. AdSense: needs a custom domain (not `*.github.io`), a privacy policy page, and a Google-certified consent banner for EEA/UK visitors.
