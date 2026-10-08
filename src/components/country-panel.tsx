import { XIcon } from 'lucide-react'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Entry } from '@/data'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  subtitle: string
  entries: Entry[]
  // Map color of this country's #1, used as the #1 marker.
  topColor?: string
  // The legend's colored items (the most widespread #1s), so they're marked
  // wherever they appear in this list, not only at #1.
  itemColors: Map<string, { color: string; countries: number }>
  footer?: ReactNode
  // 'sheet' on phones: docked to the bottom edge with a drag handle.
  variant: 'side' | 'sheet'
  onClose: () => void
}

// Dragging the sheet down further than this closes it.
const DISMISS_PX = 96

export function CountryPanel({ name, subtitle, entries, topColor, itemColors, footer, variant, onClose }: Props) {
  const sheet = variant === 'sheet'
  const drag = useSheetDrag(onClose)
  const [first, ...rest] = entries
  // With an image, #1 gets a hero card and the list continues from #2.
  const hero = first?.image ? first : undefined
  const listed = hero ? rest : entries

  return (
    <Card
      className={cn(
        'pointer-events-auto flex max-h-full w-full flex-col gap-3 bg-card/85 backdrop-blur-md',
        sheet &&
          'rounded-b-none pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] duration-300 ease-out animate-in slide-in-from-bottom',
      )}
      style={sheet ? { transform: `translateY(${drag.offset}px)`, transition: drag.active ? 'none' : undefined } : undefined}
    >
      {sheet && (
        // The handle is the drag surface; touch-action keeps the page from scrolling instead.
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={drag.start}
          onPointerMove={drag.move}
          onPointerUp={drag.end}
          onPointerCancel={drag.cancel}
          onLostPointerCapture={drag.cancel}
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
        </div>
      )}
      <CardHeader className="relative">
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute -top-2 right-1.5 size-11 sm:top-0 sm:right-3 sm:size-7"
          onClick={onClose}
          aria-label="Close panel"
        >
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {entries.length ? (
          <ScrollArea className="min-h-0 flex-1 sm:max-h-[calc(100dvh-16rem)]">
            <div className="flex flex-col gap-2 pr-3">
              {hero && <Hero entry={hero} topColor={topColor} />}
              <ol className="flex flex-col">
                {listed.map((e) => (
                  <Row key={`${e.rank}-${e.name}`} entry={e} topColor={topColor} itemColors={itemColors} />
                ))}
              </ol>
            </div>
          </ScrollArea>
        ) : (
          <p className="py-8 text-center text-muted-foreground">No data for this range.</p>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}

function useSheetDrag(onClose: () => void) {
  const startY = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const reset = () => {
    startY.current = null
    setOffset(0)
  }
  return {
    offset,
    active: startY.current !== null,
    start(e: PointerEvent<HTMLElement>) {
      startY.current = e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    move(e: PointerEvent<HTMLElement>) {
      if (startY.current === null) return
      setOffset(Math.max(0, e.clientY - startY.current))
    },
    end() {
      if (startY.current === null) return
      const dismiss = offset > DISMISS_PX
      reset()
      if (dismiss) onClose()
    },
    cancel: reset,
  }
}

function Hero({ entry: e, topColor }: { entry: Entry; topColor?: string }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        {/* Blurred copy fills the frame so square album art and wide photos both sit well. */}
        <img
          src={e.image}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
        />
        <img
          src={e.image}
          alt={e.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-contain"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className="mb-1.5 gap-1.5">
              {topColor && <span className="size-2 rounded-full" style={{ background: topColor }} aria-hidden />}
              #1
            </Badge>
            <p className="truncate text-base font-semibold text-white">{e.name}</p>
            {e.detail && <p className="truncate text-xs text-white/75">{e.detail}</p>}
          </div>
        </div>
      </div>
      {e.credit && <figcaption className="text-[10px] leading-snug text-muted-foreground">{e.credit}</figcaption>}
    </figure>
  )
}

function Row({
  entry: e,
  topColor,
  itemColors,
}: {
  entry: Entry
  topColor?: string
  itemColors: Map<string, { color: string; countries: number }>
}) {
  const first = e.rank === 1
  const legendItem = itemColors.get(e.name)
  // #1 always shows its map color ("Other" grey included); lower ranks only when
  // the item is one of the legend's colored #1s elsewhere.
  const color = first ? topColor : legendItem?.color
  const hint = legendItem ? `#1 in ${legendItem.countries} countries` : undefined
  return (
    <li className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
        {e.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className={first ? 'truncate font-semibold' : 'truncate font-medium'}>{e.name}</p>
        {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
      </div>
      {color && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title={hint}>
          {hint && !first && <span className="sr-only">{hint}</span>}
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        </span>
      )}
    </li>
  )
}
