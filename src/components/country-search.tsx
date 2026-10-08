import { SearchIcon } from 'lucide-react'
import { useMemo } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { InputGroupAddon } from '@/components/ui/input-group'

type Item = { value: string; label: string; color?: string }

type Props = {
  // Every ISO2 code to offer: countries on the globe plus small ones with data
  // that the low-res map doesn't draw (Singapore, Hong Kong...).
  codes: string[]
  nameOf: (iso2: string) => string
  // Map color of each country's #1; countries without one are listed as "No data".
  colorOf: (iso2: string) => string | undefined
  selected: string | null
  onSelect: (iso2: string | null) => void
}

export function CountrySearch({ codes, nameOf, colorOf, selected, onSelect }: Props) {
  const items = useMemo(
    () =>
      codes
        .map((value) => ({ value, label: nameOf(value), color: colorOf(value) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [codes, nameOf, colorOf],
  )
  const value = items.find((i) => i.value === selected) ?? null

  return (
    <Combobox<Item>
      items={items}
      value={value}
      onValueChange={(item) => onSelect(item?.value ?? null)}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      // Enter picks the top match without arrowing down first.
      autoHighlight
    >
      <ComboboxInput
        placeholder="Search a country"
        aria-label="Search a country"
        showTrigger={false}
        showClear={!!value}
        className="h-11 w-full bg-background/60 backdrop-blur sm:h-8 sm:w-64"
      >
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>No country found.</ComboboxEmpty>
        <ComboboxList>
          {(item: Item) => (
            <ComboboxItem key={item.value} value={item} disabled={!item.color}>
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: item.color ?? 'transparent', boxShadow: item.color ? undefined : 'inset 0 0 0 1px var(--border)' }}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
              {!item.color && <span className="ml-auto text-xs text-muted-foreground">No data</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
