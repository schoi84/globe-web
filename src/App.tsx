import { useEffect, useMemo, useState } from 'react'

import { AdSlot } from '@/components/ad-slot'
import { CountryPanel } from '@/components/country-panel'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { WorldGlobe, type CountryTop } from '@/components/world-globe'
import { countryName, loadCountries } from '@/countries'
import { CATEGORIES, loadCategory, topItems, type CategoryData, type CategoryId, type TopItem } from '@/data'
import { NO_DATA, OTHER, SERIES } from '@/palette'

// What one ranked item is called, per category.
const NOUN: Record<CategoryId, string> = {
  movies: 'movie',
  tv: 'show',
  music: 'song',
  foods: 'food',
  games: 'game',
}

type Loaded = Partial<Record<CategoryId, CategoryData | null>>

export default function App() {
  const countries = useMemo(loadCountries, [])
  const [loaded, setLoaded] = useState<Loaded>({})
  const [category, setCategory] = useState<CategoryId>('movies')
  const [rangeByCategory, setRangeByCategory] = useState<Partial<Record<CategoryId, string>>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const isWide = useMediaQuery('(min-width: 640px)')

  useEffect(() => {
    for (const c of CATEGORIES) {
      loadCategory(c.id).then(
        (d) => setLoaded((prev) => ({ ...prev, [c.id]: d })),
        () => setLoaded((prev) => ({ ...prev, [c.id]: null })),
      )
    }
  }, [])

  const current = loaded[category]
  const rangeId = rangeByCategory[category] ?? current?.ranges[0]?.id
  const range = current?.ranges.find((r) => r.id === rangeId)
  const byCountry = useMemo(() => (current && rangeId ? current.data[rangeId] ?? {} : {}), [current, rangeId])

  // Color follows the item, never its rank: the three most widespread #1s get
  // the series hues, every other #1 is "Other".
  const legend = useMemo(() => topItems(byCountry), [byCountry])
  const tops = useMemo(() => {
    const colorOf = new Map(legend.slice(0, SERIES.length).map((t, i) => [t.name, SERIES[i]]))
    const m = new Map<string, CountryTop>()
    for (const [iso2, entries] of Object.entries(byCountry)) {
      const first = entries[0]
      if (first) m.set(iso2, { name: first.name, detail: first.detail, color: colorOf.get(first.name) ?? OTHER })
    }
    return m
  }, [byCountry, legend])

  const selectedFeature = countries.find((c) => c.properties.iso2 === selected)
  const entries = selected ? byCountry[selected] : undefined
  const noun = NOUN[category]

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,#11151c_0%,#09090b_70%)]">
      <WorldGlobe
        countries={countries}
        tops={tops}
        noun={noun}
        selected={selected}
        onSelect={setSelected}
        reserveRight={selected && isWide ? 432 : 0}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">World Charts</h1>
          <p className="text-sm text-muted-foreground">
            {current === undefined
              ? 'Loading…'
              : current
                ? `What's #1 in each country · ${range?.note ?? range?.label ?? ''}`
                : 'Coming soon'}
          </p>
        </div>
        <div className="pointer-events-auto flex flex-col items-start gap-2 sm:items-end">
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[category]}
            onValueChange={(v) => v[0] && setCategory(v[0] as CategoryId)}
            className="max-w-full overflow-x-auto bg-background/60 backdrop-blur"
            aria-label="Category"
          >
            {CATEGORIES.map((c) => (
              <ToggleGroupItem
                key={c.id}
                value={c.id}
                disabled={loaded[c.id] === null}
                className="gap-1.5 px-3"
                title={loaded[c.id] === null ? `${c.label}: coming soon` : c.label}
              >
                <c.icon />
                <span className="hidden md:inline">{c.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {current && current.ranges.length > 1 && (
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={rangeId ? [rangeId] : []}
              onValueChange={(v) => v[0] && setRangeByCategory((p) => ({ ...p, [category]: v[0] as string }))}
              className="bg-background/60 backdrop-blur"
              aria-label="Time range"
            >
              {current.ranges.map((r) => (
                <ToggleGroupItem key={r.id} value={r.id} className="px-3">
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </header>

      {current && <Legend items={legend} noun={noun} source={current.source} />}

      {selected && current && (
        <aside className="pointer-events-none absolute inset-x-3 bottom-3 flex max-h-[60dvh] sm:inset-x-auto sm:top-32 sm:right-6 sm:bottom-6 sm:max-h-none sm:w-96">
          <CountryPanel
            name={countryName(selected, selectedFeature?.properties.name ?? selected)}
            subtitle={`Top 10 ${noun === 'show' ? 'shows' : `${noun}s`} · ${range?.note ?? range?.label ?? ''}`}
            entries={entries ?? []}
            topColor={tops.get(selected)?.color}
            footer={<AdSlot className="border-t border-border/60 pt-3" />}
            onClose={() => setSelected(null)}
          />
        </aside>
      )}
    </div>
  )
}

function Legend({ items, noun, source }: { items: TopItem[]; noun: string; source: CategoryData['source'] }) {
  const shown = items.slice(0, SERIES.length)
  const otherCount = items.slice(SERIES.length).reduce((n, t) => n + t.countries, 0)
  return (
    <div className="pointer-events-none absolute bottom-6 left-6 hidden max-w-72 flex-col gap-2 text-xs sm:flex">
      <span className="text-muted-foreground">#1 {noun} by country</span>
      <ul className="flex flex-col gap-1.5">
        {shown.map((t, i) => (
          <LegendRow key={t.name} color={SERIES[i]} label={t.name} count={t.countries} />
        ))}
        {otherCount > 0 && <LegendRow color={OTHER} label="Other" count={otherCount} />}
        <LegendRow color={NO_DATA} label="No data" ring />
      </ul>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="pointer-events-auto mt-1 text-muted-foreground underline-offset-2 hover:underline"
      >
        Data: {source.name}
      </a>
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
      {count != null && (
        <span className="ml-auto pl-2 font-mono text-muted-foreground tabular-nums">{count}</span>
      )}
    </li>
  )
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
