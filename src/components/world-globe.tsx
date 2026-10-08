// Loaded lazily (see App.tsx): three.js, globe.gl and the map data live in this
// chunk so the header, search and data can render before the globe arrives.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'

import { countryName, loadCountries, type CountryFeature } from '@/countries'
import { NO_DATA } from '@/palette'

export type CountryTop = { color: string; name: string; detail?: string }

// Space the globe must leave free for overlays (header, side panel, bottom sheet).
export type GlobeInsets = { top: number; right: number; bottom: number }

type Props = {
  // #1 item and its map color per ISO2 code; missing means no data.
  tops: Map<string, CountryTop>
  noun: string
  selected: string | null
  onSelect: (iso2: string | null) => void
  insets: GlobeInsets
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function WorldGlobe({ tops, noun, selected, onSelect, insets }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    loadCountries().then(setCountries)
  }, [])

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fly to the selected country so it sits in the middle of the free area.
  useEffect(() => {
    if (!selected || !globeRef.current) return
    const f = countries.find((c) => c.properties.iso2 === selected)
    if (!f) return
    const [lng, lat] = centroid(f)
    globeRef.current.pointOfView({ lat, lng, altitude: 2 }, reducedMotion() ? 0 : 900)
  }, [selected, countries, insets.top, insets.bottom, insets.right])

  const material = useMemo(
    () => new MeshPhongMaterial({ color: '#141416', emissive: '#08080a', shininess: 4 }),
    [],
  )

  // Accessors only change with the data or the selection, never on hover:
  // globe.gl re-evaluates every polygon whenever an accessor changes.
  const topOf = useCallback(
    (f: CountryFeature) => (f.properties.iso2 ? tops.get(f.properties.iso2) : undefined),
    [tops],
  )
  const capColor = useCallback((d: object) => topOf(d as CountryFeature)?.color ?? NO_DATA, [topOf])
  // The surface-colored stroke doubles as the gap between neighboring fills.
  const strokeColor = useCallback(
    (d: object) => ((d as CountryFeature).properties.iso2 === selected ? '#ffffff' : '#141416'),
    [selected],
  )
  const altitude = useCallback(
    (d: object) => ((d as CountryFeature).properties.iso2 === selected ? 0.04 : 0.008),
    [selected],
  )
  const label = useCallback((d: object) => tooltip(d as CountryFeature, topOf(d as CountryFeature), noun), [topOf, noun])

  return (
    <div
      className="absolute left-0"
      style={{ top: insets.top }}
      role="img"
      aria-label={`Globe colored by each country's #1 ${noun}. Use the search box to open a country.`}
    >
      <Globe
        ref={globeRef}
        width={Math.max(size.w - insets.right, 200)}
        height={Math.max(size.h - insets.top - insets.bottom, 160)}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={material}
        showAtmosphere
        atmosphereColor="#3987e5"
        atmosphereAltitude={0.12}
        polygonsData={countries}
        polygonCapColor={capColor}
        polygonSideColor={() => 'rgba(255, 255, 255, 0.04)'}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonsTransitionDuration={reducedMotion() ? 0 : 250}
        polygonLabel={label}
        onPolygonHover={(d) => {
          document.body.style.cursor = d && topOf(d as CountryFeature) ? 'pointer' : ''
        }}
        onPolygonClick={(d) => {
          const f = d as CountryFeature
          if (f.properties.iso2 && topOf(f)) onSelect(f.properties.iso2)
        }}
        onGlobeClick={() => onSelect(null)}
      />
    </div>
  )
}

function tooltip(f: CountryFeature, top: CountryTop | undefined, noun: string) {
  const { iso2, name } = f.properties
  const title = iso2 ? countryName(iso2, name) : name
  const body = top
    ? `<span class="row"><i style="background:${top.color}"></i>#1 ${noun}: ${escapeHtml(top.name)}</span>`
    : '<span>No data</span>'
  return `<div class="globe-tooltip"><b>${escapeHtml(title)}</b>${body}</div>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// Rough centroid: average of the largest ring's points. Good enough for camera targeting.
function centroid(f: CountryFeature): [number, number] {
  const g = f.geometry
  let ring: number[][] = []
  if (g.type === 'Polygon') ring = g.coordinates[0]
  else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) if (poly[0].length > ring.length) ring = poly[0]
  }
  if (!ring.length) return [0, 0]
  const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / ring.length, sum[1] / ring.length]
}
