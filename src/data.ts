// Data layer. The UI only talks to this module. Each category is one static
// file written by the pipeline: public/data/<category>.json.
import { FilmIcon, Gamepad2Icon, MusicIcon, TvIcon, UtensilsIcon, type LucideIcon } from 'lucide-react'

export type CategoryId = 'movies' | 'tv' | 'music' | 'foods' | 'games'

export type Category = { id: CategoryId; label: string; icon: LucideIcon }

export const CATEGORIES: Category[] = [
  { id: 'movies', label: 'Movies', icon: FilmIcon },
  { id: 'tv', label: 'TV', icon: TvIcon },
  { id: 'music', label: 'Music', icon: MusicIcon },
  { id: 'foods', label: 'Food', icon: UtensilsIcon },
  { id: 'games', label: 'Games', icon: Gamepad2Icon },
]

export type Entry = {
  rank: number
  name: string
  // Secondary line: artist, season, weeks in Top 10.
  detail?: string
  // Hero image, only present (and shown) for #1.
  image?: string
  // Attribution the image's license requires, e.g. "Photo: X, CC BY-SA 4.0, via Wikimedia Commons".
  credit?: string
}

export type RangeInfo = { id: string; label: string; note?: string }

export type CategoryData = {
  generatedAt: string
  source: { name: string; url: string }
  ranges: RangeInfo[]
  data: Record<string, Record<string, Entry[]>>
}

const cache = new Map<CategoryId, Promise<CategoryData | null>>()

// Resolves to null when the category has no data file yet.
export function loadCategory(id: CategoryId): Promise<CategoryData | null> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${id}.json`).then(async (res) => {
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to load ${id}: ${res.status}`)
      // Vite's dev server answers missing files with index.html.
      if (!res.headers.get('content-type')?.includes('json')) return null
      return res.json()
    })
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

export type TopItem = { name: string; countries: number }

// The most common #1 items across countries, most widespread first.
export function topItems(byCountry: Record<string, Entry[]>): TopItem[] {
  const counts = new Map<string, number>()
  for (const entries of Object.values(byCountry)) {
    const first = entries[0]?.name
    if (first) counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, countries]) => ({ name, countries }))
    .sort((a, b) => b.countries - a.countries || a.name.localeCompare(b.name))
}
