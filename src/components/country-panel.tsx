import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Entry } from '@/data'

type Props = {
  name: string
  subtitle: string
  entries: Entry[]
  // Map color of this country's #1, used as the #1 row's marker.
  topColor?: string
  footer?: ReactNode
  onClose: () => void
}

export function CountryPanel({ name, subtitle, entries, topColor, footer, onClose }: Props) {
  return (
    <Card className="pointer-events-auto flex max-h-full w-full flex-col gap-3 bg-card/85 backdrop-blur-md">
      <CardHeader className="relative">
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-0 right-3"
          onClick={onClose}
          aria-label="Close panel"
        >
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {entries.length ? (
          <ScrollArea className="min-h-0 flex-1 sm:max-h-[calc(100dvh-14rem)]">
            <ol className="flex flex-col pr-3">
              {entries.map((e) => (
                <Row key={`${e.rank}-${e.name}`} entry={e} topColor={topColor} />
              ))}
            </ol>
          </ScrollArea>
        ) : (
          <p className="py-8 text-center text-muted-foreground">No data for this range.</p>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}

function Row({ entry: e, topColor }: { entry: Entry; topColor?: string }) {
  const first = e.rank === 1
  return (
    <li className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
        {e.rank}
      </span>
      {first && e.image && (
        <Avatar size="lg" className="size-12 rounded-md after:rounded-md">
          <AvatarImage src={e.image} alt="" className="rounded-md" referrerPolicy="no-referrer" />
          <AvatarFallback className="rounded-md">{initials(e.name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <p className={first ? 'truncate font-semibold' : 'truncate font-medium'}>{e.name}</p>
        {e.detail && <p className="truncate text-xs text-muted-foreground">{e.detail}</p>}
      </div>
      {first && topColor && (
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: topColor }} aria-hidden />
      )}
    </li>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
