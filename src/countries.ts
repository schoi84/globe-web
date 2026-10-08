import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import type { Feature, Geometry } from 'geojson'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'

countries.registerLocale(en)

export type CountryProps = { name: string; iso2?: string }
export type CountryFeature = Feature<Geometry, CountryProps>

// Natural Earth 110m polygons from world-atlas, tagged with ISO alpha-2 codes.
export function loadCountries(): CountryFeature[] {
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
  const fc = feature(topo, topo.objects.countries)
  return fc.features
    .filter((f) => f.properties.name !== 'Antarctica')
    .map((f) => ({
      ...f,
      properties: {
        name: f.properties.name,
        iso2: f.id != null ? countries.numericToAlpha2(String(f.id)) : undefined,
      },
    }))
}

export function countryName(iso2: string, fallback: string) {
  return countries.getName(iso2, 'en', { select: 'alias' }) ?? fallback
}
