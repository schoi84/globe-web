import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'

import { countryName, type CountryFeature } from '@/countries'
import { NO_DATA } from '@/palette'

export type CountryTop = { color: string; name: string; detail?: string }

type Props = {
  countries: CountryFeature[]
  // #1 item and its map color per ISO2 code; missing means no data.
  tops: Map<string, CountryTop>
  noun: string
  selected: string | null
  onSelect: (iso2: string | null) => void
  // Pixels reserved on the right for the side panel.
  reserveRight?: number
}

export function WorldGlobe({ countries, tops, noun, selected, onSelect, reserveRight = 0 }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [hovered, setHovered] = useState<CountryFeature | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Slow auto-rotate until the user picks a country.
  useEffect(() => {
    const controls = globeRef.current?.controls()
    if (!controls) return
    controls.autoRotate = selected == null
    controls.autoRotateSpeed = 0.35
  }, [selected])

  // Fly to the selected country's centroid.
  useEffect(() => {
    if (!selected || !globeRef.current) return
    const f = countries.find((c) => c.properties.iso2 === selected)
    if (!f) return
    const [lng, lat] = centroid(f)
    globeRef.current.pointOfView({ lat, lng, altitude: 2 }, 900)
  }, [selected, countries])

  const material = useMemo(
    () => new MeshPhongMaterial({ color: '#141416', emissive: '#08080a', shininess: 4 }),
    [],
  )

  const topOf = (f: CountryFeature) => (f.properties.iso2 ? tops.get(f.properties.iso2) : undefined)

  return (
    <Globe
      ref={globeRef}
      width={size.w - reserveRight}
      height={size.h}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={material}
      showAtmosphere
      atmosphereColor="#3987e5"
      atmosphereAltitude={0.12}
      polygonsData={countries}
      polygonCapColor={(d) => topOf(d as CountryFeature)?.color ?? NO_DATA}
      polygonSideColor={() => 'rgba(255, 255, 255, 0.04)'}
      // The surface-colored stroke doubles as the gap between neighboring fills.
      polygonStrokeColor={(d) => (d === hovered || (d as CountryFeature).properties.iso2 === selected ? '#ffffff' : '#141416')}
      polygonAltitude={(d) => {
        const f = d as CountryFeature
        if (f.properties.iso2 === selected) return 0.04
        return f === hovered ? 0.025 : 0.008
      }}
      polygonsTransitionDuration={250}
      polygonLabel={(d) => tooltip(d as CountryFeature, topOf(d as CountryFeature), noun)}
      onPolygonHover={(d) => {
        setHovered(d as CountryFeature | null)
        document.body.style.cursor = d ? 'pointer' : ''
      }}
      onPolygonClick={(d) => {
        const f = d as CountryFeature
        if (f.properties.iso2 && topOf(f)) onSelect(f.properties.iso2)
      }}
      onGlobeClick={() => onSelect(null)}
    />
  )
}

function tooltip(f: CountryFeature, top: CountryTop | undefined, noun: string) {
  const { iso2, name } = f.properties
  const label = iso2 ? countryName(iso2, name) : name
  const body = top
    ? `<span class="row"><i style="background:${top.color}"></i>#1 ${noun}: ${escapeHtml(top.name)}</span>`
    : '<span>No data</span>'
  return `<div class="globe-tooltip"><b>${escapeHtml(label)}</b>${body}</div>`
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
