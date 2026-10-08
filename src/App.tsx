import { ChevronUpIcon } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { AdSlot } from '@/components/ad-slot'
import { CountryPanel } from '@/components/country-panel'
import { CountrySearch } from '@/components/country-search'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CountryTop, GlobeInsets } from '@/components/world-globe'
import { ALL_ISO2, countryName } from '@/countries'
import { CATEGORIES, loadCategory, topItems, type CategoryData, type CategoryId, type TopItem } from '@/data'
import { NO_DATA, OTHER, SERIES } from '@/palette'

// three.js + the map data are ~2 MB; load them after the shell renders.
const WorldGlobe = lazy(() => import('@/components/world-globe'))

// What one ranked item is called, per category.
const NOUN: Record<CategoryId, { one: string; many: string }> = {
  movies: { one: 'movie', many: 'movies' },
  tv: { one: 'show', many: 'shows' },
  music: { one: 'song', many: 'songs' },
  foods: { one: 'food', many: 'foods' },
  games: { one: 'game', many: 'games' },
}

const RANGES = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

// Why a category lacks a range, shown when the shared range choice can't apply.
function rangeGap(category: CategoryId, rangeLabel: string): string {
  switch (category) {
    case 'movies':
    case 'tv':
      return `Netflix publishes weekly charts, so there's no ${rangeLabel} view.`
    case 'music':
      return `Music has no ${rangeLabel} chart yet. Longer ranges fill in as daily charts are collected.`
    default:
      return `No ${rangeLabel} data for this category.`
  }
}

// undefined = loading, null = no file yet, 'error' = failed to load.
type LoadState = CategoryData | null | 'error' | undefined

// The bottom sheet takes this share of the screen on phones.
const SHEET_SHARE = 0.5

export default function App() {
  const [loaded, setLoaded] = useState<Partial<Record<CategoryId, LoadState>>>({})
  // Initial state comes from the URL (?c=music&range=week&country=KR) so views can be shared.
  const [category, setCategory] = useState<CategoryId>(() => {
    const c = urlParam('c')
    return CATEGORIES.some((x) => x.id === c) ? (c as CategoryId) : 'movies'
  })
  // One range choice shared by all categories (e.g. Week everywhere it exists).
  const [rangePref, setRangePref] = useState(() => urlParam('range') ?? 'week')
  const [selected, setSelected] = useState<string | null>(() => urlParam('country')?.toUpperCase() ?? null)
  const isWide = useMediaQuery('(min-width: 640px)')
  const headerRef = useRef<HTMLElement>(null)
  const headerHeight = useElementHeight(headerRef)
  const viewportHeight = useViewportHeight()

  useEffect(() => {
    const params = new URLSearchParams({ c: category, range: rangePref })
    if (selected) params.set('country', selected)
    history.replaceState(null, '', `?${params}`)
  }, [category, rangePref, selected])

  // Data loads per category, on demand (and on hover/focus of its tab, so it's usually ready).
  const ensureLoaded = useCallback((id: CategoryId) => {
    loadCategory(id).then(
      (d) => setLoaded((prev) => ({ ...prev, [id]: d })),
      () => setLoaded((prev) => ({ ...prev, [id]: 'error' })),
    )
  }, [])
  useEffect(() => ensureLoaded(category), [category, ensureLoaded])

  const state = loaded[category]
  const current = state && state !== 'error' ? state : undefined
  const available = current?.ranges.map((r) => r.id) ?? []
  const rangeId = pickRange(available, rangePref)
  const range = current?.ranges.find((r) => r.id === rangeId)
  const byCountry = useMemo(() => (current && rangeId ? current.data[rangeId] ?? {} : {}), [current, rangeId])
  const fellBack = !!current && rangeId !== rangePref
  const prefLabel = RANGES.find((r) => r.id === rangePref)?.label ?? rangePref

  // Color follows the item, never its rank: the three most widespread #1s get
  // the series hues, every other #1 is "Other".
  const legend = useMemo(() => topItems(byCountry), [byCountry])
  const itemColors = useMemo(
    () => new Map(legend.slice(0, SERIES.length).map((t, i) => [t.name, { color: SERIES[i], countries: t.countries }])),
    [legend],
  )
  const tops = useMemo(() => {
    const m = new Map<string, CountryTop>()
    for (const [iso2, entries] of Object.entries(byCountry)) {
      const first = entries[0]
      if (first) m.set(iso2, { name: first.name, detail: first.detail, color: itemColors.get(first.name)?.color ?? OTHER })
    }
    return m
  }, [byCountry, itemColors])

  const nameOf = useCallback((iso2: string) => countryName(iso2), [])
  const colorOf = useCallback((iso2: string) => tops.get(iso2)?.color, [tops])

  const noun = NOUN[category]
  const entries = selected ? byCountry[selected] : undefined
  const sheetOpen = !!selected && !!current && !isWide
  // Keep the selected country in view: beside the side panel on desktop,
  // between the header and the bottom sheet on phones.
  const insets: GlobeInsets = isWide
    ? { top: 0, right: selected ? 432 : 0, bottom: 0 }
    : sheetOpen
      ? { top: headerHeight, right: 0, bottom: Math.round(viewportHeight * SHEET_SHARE) }
      : { top: 0, right: 0, bottom: 0 }

  const status =
    state === undefined
      ? `Loading ${noun.many}…`
      : state === 'error'
        ? `Couldn't load ${noun.many}.`
        : state === null
          ? `No ${noun.one} charts yet.`
          : `What's #1 in each country · ${range?.note ?? range?.label ?? ''}`

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#11151c_0%,#09090b_70%)]">
      <Suspense fallback={<GlobePlaceholder />}>
        <WorldGlobe tops={tops} noun={noun.one} selected={selected} onSelect={setSelected} insets={insets} />
      </Suspense>

      <header
        ref={headerRef}
        className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">World Charts</h1>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {status}
              {state === 'error' && (
                <button
                  type="button"
                  className="pointer-events-auto ml-1.5 text-foreground underline underline-offset-2"
                  onClick={() => ensureLoaded(category)}
                >
                  Try again
                </button>
              )}
            </p>
          </div>
          <div className="pointer-events-auto">
            <CountrySearch
              codes={ALL_ISO2}
              nameOf={nameOf}
              colorOf={colorOf}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col gap-2 sm:items-end">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[category]}
            onValueChange={(v) => v[0] && setCategory(v[0] as CategoryId)}
            className="w-full bg-background/60 backdrop-blur sm:w-fit"
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <ToggleGroupItem
                key={c.id}
                value={c.id}
                className="h-11 flex-1 gap-1.5 px-2 sm:h-8 sm:flex-none sm:px-3"
                onPointerEnter={() => loadCategory(c.id)}
                onFocus={() => loadCategory(c.id)}
              >
                <c.icon className="hidden sm:block" />
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[rangePref]}
            onValueChange={(v) => v[0] && setRangePref(v[0] as string)}
            className="w-full bg-background/60 backdrop-blur sm:w-fit"
            aria-label="Time range"
          >
            {RANGES.map((r) => {
              const missing = !!current && !available.includes(r.id)
              return (
                <ToggleGroupItem
                  key={r.id}
                  value={r.id}
                  // Still selectable: it stays the choice for categories that have it.
                  className={missing ? 'h-11 flex-1 px-3 text-muted-foreground/60 sm:h-7 sm:flex-none' : 'h-11 flex-1 px-3 sm:h-7 sm:flex-none'}
                  title={missing ? rangeGap(category, r.label) : undefined}
                >
                  {r.label}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
          {fellBack && (
            <p className="max-w-80 text-xs text-muted-foreground sm:text-right" aria-live="polite">
              Showing {range?.label}. {rangeGap(category, prefLabel)}
            </p>
          )}
        </div>
      </header>

      {current && !sheetOpen && (
        <>
          <Legend
            items={legend}
            noun={noun.one}
            source={current.source}
            imageSource={current.imageSource}
            className="hidden sm:flex"
          />
          {!isWide && (
            <LegendChip items={legend} noun={noun.one} source={current.source} imageSource={current.imageSource} />
          )}
        </>
      )}

      {selected && current && (
        <aside
          className={
            isWide
              ? 'pointer-events-none absolute right-6 bottom-6 flex w-96'
              : 'pointer-events-none absolute inset-x-0 bottom-0 flex'
          }
          // Desktop: start just below the header, whose height varies with the range note.
          style={isWide ? { top: Math.max(headerHeight, 96) } : { maxHeight: `${SHEET_SHARE * 100}dvh` }}
        >
          <CountryPanel
            name={countryName(selected)}
            subtitle={`Top 10 ${noun.many} · ${range?.note ?? range?.label ?? ''}`}
            entries={entries ?? []}
            topColor={tops.get(selected)?.color}
            itemColors={itemColors}
            footer={<AdSlot className="border-t border-border/60 pt-3" />}
            variant={isWide ? 'side' : 'sheet'}
            onClose={() => setSelected(null)}
          />
        </aside>
      )}
    </div>
  )
}

function GlobePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="size-[min(70vw,28rem)] animate-pulse rounded-full bg-white/[0.03] ring-1 ring-white/5" />
    </div>
  )
}

type LegendProps = { items: TopItem[]; noun: string } & Pick<CategoryData, 'source' | 'imageSource'>

function legendRows(items: TopItem[]) {
  const shown = items.slice(0, SERIES.length)
  const otherCount = items.slice(SERIES.length).reduce((n, t) => n + t.countries, 0)
  return { shown, otherCount }
}

function LegendList({ items }: { items: TopItem[] }) {
  const { shown, otherCount } = legendRows(items)
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((t, i) => (
        <LegendRow key={t.name} color={SERIES[i]} label={t.name} count={t.countries} />
      ))}
      {otherCount > 0 && <LegendRow color={OTHER} label="Other" count={otherCount} />}
      <LegendRow color={NO_DATA} label="No data" ring />
    </ul>
  )
}

function SourceLink({ source, imageSource }: Pick<CategoryData, 'source' | 'imageSource'>) {
  const link = 'pointer-events-auto text-muted-foreground underline-offset-2 hover:underline'
  return (
    <span className="flex flex-col gap-1">
      <a href={source.url} target="_blank" rel="noreferrer" className={link}>
        Data: {source.name}
      </a>
      {imageSource && (
        <>
          <a href={imageSource.url} target="_blank" rel="noreferrer" className={link}>
            {imageSource.label}: {imageSource.name}
          </a>
        </>
      )}
    </span>
  )
}

function Legend({ items, noun, source, imageSource, className }: LegendProps & { className?: string }) {
  return (
    <div className={`pointer-events-none absolute bottom-6 left-6 max-w-72 flex-col gap-2 text-xs ${className ?? ''}`}>
      <span className="text-muted-foreground">#1 {noun} by country</span>
      <LegendList items={items} />
      <span className="mt-1">
        <SourceLink source={source} imageSource={imageSource} />
      </span>
    </div>
  )
}

// Phones: a compact chip showing the three map colors; tap to expand the full key.
function LegendChip({ items, noun, source, imageSource }: LegendProps) {
  const [open, setOpen] = useState(false)
  const { shown } = legendRows(items)
  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
      {open && (
        <div
          id="legend-details"
          className="w-64 max-w-full rounded-xl bg-popover/90 p-3 text-xs ring-1 ring-foreground/10 backdrop-blur-md duration-200 animate-in fade-in-0 slide-in-from-bottom-2"
        >
          <LegendList items={items} />
          <div className="mt-2.5 border-t border-border/60 pt-2">
            <SourceLink source={source} imageSource={imageSource} />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="legend-details"
        className="flex h-11 items-center gap-2 rounded-full bg-background/70 pr-3 pl-3.5 text-sm ring-1 ring-foreground/10 backdrop-blur-md"
      >
        <span className="flex -space-x-1" aria-hidden>
          {shown.map((t, i) => (
            <span key={t.name} className="size-3 rounded-full ring-2 ring-background" style={{ background: SERIES[i] }} />
          ))}
        </span>
        <span>#1 {noun} key</span>
        <ChevronUpIcon className={`size-4 text-muted-foreground transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
    </div>
  )
}

function LegendRow({ color, label, count, ring }: { color: string; label: string; count?: number; ring?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={ring ? 'size-2.5 shrink-0 rounded-sm ring-1 ring-white/20' : 'size-2.5 shrink-0 rounded-sm'}
        style={{ background: color }}
      />
      <span className="truncate text-foreground">{label}</span>
      {count != null && <span className="ml-auto pl-2 text-muted-foreground tabular-nums">{count}</span>}
    </li>
  )
}

function urlParam(name: string) {
  return new URLSearchParams(window.location.search).get(name)
}

const RANGE_ORDER = RANGES.map((r) => r.id)

// The preferred range if this category has it, else the nearest one it does have.
function pickRange(available: string[], preferred: string) {
  if (available.includes(preferred)) return preferred
  const target = RANGE_ORDER.indexOf(preferred)
  return [...available].sort(
    (a, b) => Math.abs(RANGE_ORDER.indexOf(a) - target) - Math.abs(RANGE_ORDER.indexOf(b) - target),
  )[0]
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function useElementHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return height
}

function useViewportHeight() {
  const [h, setH] = useState(window.innerHeight)
  useEffect(() => {
    const onResize = () => setH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return h
}
