import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import type { Feature, Geometry } from 'geojson'

countries.registerLocale(en)

export type CountryProps = { name: string; iso2?: string }
export type CountryFeature = Feature<Geometry, CountryProps>

// Natural Earth 110m polygons from world-atlas, tagged with ISO alpha-2 codes.
// Imported dynamically so the map data ships in the globe's chunk.
export async function loadCountries(): Promise<CountryFeature[]> {
  const [{ feature }, world] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/countries-110m.json'),
  ])
  type Topo = import('topojson-specification').Topology<{
    countries: import('topojson-specification').GeometryCollection<{ name: string }>
  }>
  const topo = (world.default ?? world) as unknown as Topo
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

// Every ISO alpha-2 code, for the country search.
export const ALL_ISO2 = Object.keys(countries.getAlpha2Codes())

// Everyday names the library only has in a long or ambiguous form.
const NAME_OVERRIDES: Record<string, string> = {
  CD: 'DR Congo',
  CG: 'Republic of the Congo',
  LA: 'Laos',
  SY: 'Syria',
  MD: 'Moldova',
  VA: 'Vatican City',
}

// The shortest everyday name: "South Korea" over "Korea, Republic of",
// "Russia" over "Russian Federation", skipping abbreviations like "USA".
export function countryName(iso2: string, fallback = iso2) {
  if (NAME_OVERRIDES[iso2]) return NAME_OVERRIDES[iso2]
  const names = countries.getName(iso2, 'en', { select: 'all' }) ?? []
  const everyday = names.filter((n) => n.length > 4 && !/[,.]/.test(n))
  return everyday.sort((a, b) => a.length - b.length)[0] ?? names[0] ?? fallback
}
