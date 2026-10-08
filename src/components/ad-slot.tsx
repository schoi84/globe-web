import { useEffect, useRef } from 'react'

// Google AdSense unit. Renders nothing until both env vars are set, so the
// layout stays clean in development and before AdSense approval.
//   VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//   VITE_ADSENSE_SLOT=1234567890
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

let scriptAdded = false

export function AdSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!CLIENT || !SLOT || !ref.current || ref.current.dataset.adsbygoogleStatus) return
    if (!scriptAdded) {
      const s = document.createElement('script')
      s.async = true
      s.crossOrigin = 'anonymous'
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
      document.head.appendChild(s)
      scriptAdded = true
    }
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // Blocked by an ad blocker; leave the slot empty.
    }
  }, [])

  if (!CLIENT || !SLOT) return null
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] tracking-wide text-muted-foreground uppercase">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  )
}
