import { ChevronDownIcon, PlayIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

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
  // One expanded row at a time; collapse when the list changes (country, category, range).
  const [openRank, setOpenRank] = useState<number | null>(null)
  useEffect(() => setOpenRank(null), [entries])
  // With an image or trailer, #1 gets a hero card and the list continues from #2.
  const hero = first && hasMedia(first) ? first : undefined
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
                  <Row
                    key={`${e.rank}-${e.name}`}
                    entry={e}
                    topColor={topColor}
                    itemColors={itemColors}
                    open={openRank === e.rank}
                    onToggle={() => setOpenRank((r) => (r === e.rank ? null : e.rank))}
                  />
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

const hasMedia = (e: Entry) => !!(e.image || e.video)
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

// A trailer thumbnail, unaltered and linking to YouTube as the API terms require.
// hqdefault always exists; it's 4:3 with letterbox bars, which the 16:9 crop removes.
function VideoFrame({ id, title }: { id: string; title: string }) {
  return (
    <a
      href={watchUrl(id)}
      target="_blank"
      rel="noreferrer"
      className="group/video relative block aspect-video overflow-hidden rounded-lg bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`Watch the ${title} trailer on YouTube`}
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-black/70 text-white transition-transform group-hover/video:scale-110">
          <PlayIcon className="size-5 translate-x-px fill-current" aria-hidden />
        </span>
      </span>
    </a>
  )
}

function Media({ entry: e }: { entry: Entry }) {
  return e.video ? <VideoFrame id={e.video} title={e.name} /> : <ImageFrame src={e.image!} alt={e.name} />
}

// Blurred copy fills the frame so square album art and wide photos both sit well.
function ImageFrame({ src, alt, children }: { src: string; alt: string; children?: ReactNode }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
      <img
        src={src}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
      />
      <img src={src} alt={alt} referrerPolicy="no-referrer" className="absolute inset-0 size-full object-contain" />
      {children}
    </div>
  )
}

function Credit({ text }: { text?: string }) {
  return text ? <figcaption className="text-[11px] leading-snug text-muted-foreground">{text}</figcaption> : null
}

function Hero({ entry: e, topColor }: { entry: Entry; topColor?: string }) {
  if (e.video) {
    // Trailer thumbnails stay unaltered, so the title sits below instead of on top.
    return (
      <figure className="flex flex-col gap-2">
        <VideoFrame id={e.video} title={e.name} />
        <figcaption className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className="mb-1.5 gap-1.5">
              {topColor && <span className="size-2 rounded-full" style={{ background: topColor }} aria-hidden />}
              #1
            </Badge>
            <p className="truncate text-base font-semibold">{e.name}</p>
            {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
          </div>
        </figcaption>
        <Credit text={e.credit} />
      </figure>
    )
  }
  return (
    <figure className="flex flex-col gap-1.5">
      <ImageFrame src={e.image!} alt={e.name}>
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
      </ImageFrame>
      <Credit text={e.credit} />
    </figure>
  )
}

function Row({
  entry: e,
  topColor,
  itemColors,
  open,
  onToggle,
}: {
  entry: Entry
  topColor?: string
  itemColors: Map<string, { color: string; countries: number }>
  open: boolean
  onToggle: () => void
}) {
  const first = e.rank === 1
  const legendItem = itemColors.get(e.name)
  // #1 always shows its map color ("Other" grey included); lower ranks only when
  // the item is one of the legend's colored #1s elsewhere.
  const color = first ? topColor : legendItem?.color
  const hint = legendItem ? `#1 in ${legendItem.countries} countries` : undefined
  const expandable = hasMedia(e)
  const panelId = `row-media-${e.rank}`

  const content = (
    <>
      <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
        {e.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', first ? 'font-semibold' : 'font-medium')}>{e.name}</span>
        {e.detail && <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>}
      </span>
      {color && (
        <span className="flex shrink-0 items-center" title={hint}>
          {hint && !first && <span className="sr-only">{hint}</span>}
          <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        </span>
      )}
      {expandable && (
        <ChevronDownIcon
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      )}
    </>
  )

  return (
    <li className="border-b border-border/60 last:border-0">
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-2.5">{content}</div>
      )}
      {expandable && open && (
        <figure id={panelId} className="flex flex-col gap-1.5 pb-3 duration-200 animate-in fade-in-0 slide-in-from-top-1">
          <Media entry={e} />
          <Credit text={e.credit} />
        </figure>
      )}
    </li>
  )
}
