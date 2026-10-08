# World Charts: project brief

Portfolio project. An interactive 3D globe showing what's #1 in each country across categories: movies, TV, music, food, games. Click a country for its top 10. Supported by ads (Google AdSense).

History: this repo started as an adult-content globe ("JAV Globe"). That was abandoned because it couldn't be monetized or shown in a portfolio. All of that code and data was removed. Don't bring any of it back.

## Data sources

| Category | Source | Key | Ranges | Script |
|---|---|---|---|---|
| Movies, TV | Netflix Top 10, `all-weeks-countries.tsv` (~93 countries) | none | `week` (latest), `month` (last 4 weeks, 11 - rank points) | `pipeline/netflix.py` |
| Music | Apple Music "most-played" RSS feeds (~150 storefronts) | none | `today` | `pipeline/apple_music.py` |
| Food, Games | Google Trends (pytrends), 20 topics each | none | `month` (30 days), `year` (12 months) | `pipeline/trends.py` |

- Apple's feed answers **500** (not 404) for countries without a storefront and is flaky for real ones. `apple_music.py` does a fast first pass, then retries only the failures once (~7 min total).
- **Trends method:** topics (not search strings) so it works across languages. Batches of [anchor + 4], scores divided by the anchor (Pizza, Minecraft) per country to share one scale. Countries need ≥3 topics with interest. Topic IDs live in `pipeline/trends_topics.json`; edit `CANDIDATES` in `resolve_topics.py` and re-run it, then **check the matches** (exact-title matching avoids look-alikes like KFC for "Fried chicken").
- Trends rate-limits hard (429). `trends_common.with_backoff` waits 60s, 120s, ... and raw batches are cached per day in `pipeline/.cache/trends/`, so a re-run resumes.
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

`detail` is the secondary line (artist, season, weeks in Top 10). `image` is only set on #1 entries.

## Frontend

- Vite + React + TypeScript, Tailwind v4, **shadcn/ui** (`base-nova` style, built on Base UI, not Radix). Add components with `npx shadcn@latest add <name>`. App is forced dark (`class="dark"` on `<html>`).
- Globe: `react-globe.gl`, with polygons from `world-atlas` (Natural Earth 110m) tagged ISO alpha-2 via `i18n-iso-countries` (`src/countries.ts`).
- **Map coloring:** each country takes the color of its #1 item. Only the **3 most widespread #1s** get hues (`src/palette.ts`: `#3987e5`, `#d95926`, `#199e70`, validated all-pairs on the dark surface by the dataviz skill). Everything else is "Other" grey. Don't add more hues: choropleths fail colorblind checks past 3.
- `src/data.ts`: category list, loader (a missing file means "coming soon", shown as a disabled category), `topItems()`.
- Components: `world-globe.tsx`, `country-panel.tsx`, `ad-slot.tsx`.
- Ads: `AdSlot` renders nothing until `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` are set (`.env.local`). It sits at the bottom of the country panel.

## Commands

- Dev: `npm run dev`. Build: `npm run build` (relative `base`, works on GitHub Pages).
- Data: `python pipeline/netflix.py`, `python pipeline/apple_music.py` (stdlib only), `python pipeline/trends.py` (needs `pip install -r pipeline/requirements.txt`). Python 3.10+.
- Tests: `cd pipeline && python -m unittest`.

## Milestones

1. ✅ Globe + panel + category and range toggles.
2. ✅ Netflix (movies, TV) and Apple Music pipelines with real data.
3. ✅ Trends job for food and games. (Sports was dropped: soccer was #1 almost everywhere.)
4. ✅ `.github/workflows/refresh-and-deploy.yml`: Apple Music daily, Netflix + Trends on Wednesdays, commit `public/data`, deploy to GitHub Pages. Trends may hit 429s from cloud IPs (step is `continue-on-error`, keeps the old files).
5. AdSense: needs a custom domain (not `*.github.io`), a privacy policy page, and a Google-certified consent banner for EEA/UK visitors.
