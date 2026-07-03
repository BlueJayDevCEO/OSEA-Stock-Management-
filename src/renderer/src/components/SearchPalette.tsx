import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Anchor, Package, QrCode, Receipt, Search, Truck, Users } from 'lucide-react'
import type { SearchResultItem } from '@shared/types'
import { useApp } from '@renderer/lib/store'

const KIND_ICON = {
  asset: Anchor,
  product: Package,
  sale: Receipt,
  po: Truck,
  supplier: Users
} as const

const KIND_ROUTE: Record<SearchResultItem['kind'], (r: SearchResultItem) => string> = {
  asset: (r) => `/rental/${r.id}`,
  product: (r) => `/retail/${r.id}`,
  sale: () => `/sales`,
  po: (r) => `/purchase-orders/${r.id}`,
  supplier: () => `/settings?tab=suppliers`
}

/**
 * Cmd/Ctrl-K palette. Also the manual entry point for QR codes: paste or
 * type any asset number / SKU / barcode / serial and hit Enter.
 */
export function SearchPalette(): JSX.Element | null {
  const open = useApp((s) => s.searchOpen)
  const setOpen = useApp((s) => s.setSearchOpen)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const r = await window.osea.reports.search(query, 15)
        if (!cancelled) {
          setResults(r)
          setActive(0)
        }
      } catch {
        /* search errors are non-fatal */
      }
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query])

  if (!open) return null

  const go = (item: SearchResultItem): void => {
    setOpen(false)
    navigate(KIND_ROUTE[item.kind](item))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-abyss-950/50 px-4 pt-[12vh] backdrop-blur-sm animate-fade-in no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="card w-full max-w-xl overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 border-b border-abyss-200/70 px-4 py-3 dark:border-abyss-800/60">
          <Search size={17} className="text-abyss-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && results[active]) {
                go(results[active])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder="Search assets, SKUs, barcodes, serials, brands, invoices…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-abyss-400"
            aria-label="Global search"
          />
          <span className="flex items-center gap-1 text-xs text-abyss-400">
            <QrCode size={13} /> scan works too
          </span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-abyss-400">
              {query.trim() ? 'No matches.' : 'Type to search everything, everywhere.'}
            </div>
          ) : (
            results.map((r, i) => {
              const Icon = KIND_ICON[r.kind]
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    i === active ? 'bg-ocean-50 dark:bg-abyss-800/60' : ''
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ocean-500/10 text-ocean-600 dark:text-ocean-300">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-abyss-400">{r.subtitle}</span>
                  </span>
                  {r.code && (
                    <span className="shrink-0 font-mono text-xs text-abyss-400">{r.code}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
