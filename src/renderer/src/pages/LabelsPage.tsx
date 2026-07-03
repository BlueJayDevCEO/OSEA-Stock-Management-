import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileDown, Printer, QrCode } from 'lucide-react'
import type { LabelTemplate } from '@shared/types'
import { qrDataUrl } from '@renderer/lib/qr'
import { useApp } from '@renderer/lib/store'
import { PageHeader, Spinner } from '@renderer/components/ui'

interface LabelData {
  id: string
  code: string
  title: string
  subtitle: string
  qr: string
}

interface TemplateSpec {
  id: LabelTemplate
  name: string
  hint: string
  pageCss: string
  sheet: boolean // true = grid on A4, false = one label per page (thermal rolls)
  cols?: number
  labelW: string
  labelH: string
  qrPx: number
}

const TEMPLATES: TemplateSpec[] = [
  {
    id: 'a4_grid_24',
    name: 'A4 sheet — 24 labels',
    hint: '3 × 8 grid, 70 × 37 mm (standard adhesive sheets)',
    pageCss: '@page { size: A4 portrait; margin: 0; }',
    sheet: true,
    cols: 3,
    labelW: '70mm',
    labelH: '37.125mm',
    qrPx: 96
  },
  {
    id: 'a4_grid_12',
    name: 'A4 sheet — 12 labels',
    hint: '2 × 6 grid, 105 × 49.5 mm (large labels)',
    pageCss: '@page { size: A4 portrait; margin: 0; }',
    sheet: true,
    cols: 2,
    labelW: '105mm',
    labelH: '49.5mm',
    qrPx: 128
  },
  {
    id: 'thermal_62x29',
    name: 'Thermal roll — 62 × 29 mm',
    hint: 'Brother QL series and compatible',
    pageCss: '@page { size: 62mm 29mm; margin: 0; }',
    sheet: false,
    labelW: '62mm',
    labelH: '29mm',
    qrPx: 88
  },
  {
    id: 'thermal_51x25',
    name: 'Thermal roll — 51 × 25 mm',
    hint: 'Zebra 2×1" and compatible',
    pageCss: '@page { size: 51mm 25mm; margin: 0; }',
    sheet: false,
    labelW: '51mm',
    labelH: '25mm',
    qrPx: 76
  }
]

export function LabelsPage(): JSX.Element {
  const [params] = useSearchParams()
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)

  const [kind, setKind] = useState<'asset' | 'product'>(
    (params.get('kind') as 'asset' | 'product' | null) ?? 'asset'
  )
  const [templateId, setTemplateId] = useState<LabelTemplate>('a4_grid_24')
  const [available, setAvailable] = useState<Array<{ id: string; code: string; title: string; subtitle: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set((params.get('ids') ?? '').split(',').filter(Boolean))
  )
  const [labels, setLabels] = useState<LabelData[] | null>([])
  const [filter, setFilter] = useState('')
  const [copies, setCopies] = useState('1')

  const template = TEMPLATES.find((t) => t.id === templateId)!

  const loadItems = useCallback(async () => {
    if (kind === 'asset') {
      const assets = await window.osea.assets.list({})
      setAvailable(
        assets.map((a) => ({
          id: a.id,
          code: a.assetNumber,
          title: [a.brandName, a.model].filter(Boolean).join(' ') || (a.equipmentTypeName ?? a.assetNumber),
          subtitle: [a.equipmentTypeName, a.size ? `Size ${a.size}` : null].filter(Boolean).join(' · ')
        }))
      )
    } else {
      const products = await window.osea.products.list({})
      setAvailable(
        products.map((p) => ({
          id: p.id,
          code: p.sku,
          title: p.name,
          subtitle: p.brandName ?? ''
        }))
      )
    }
  }, [kind])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Build label data (QR images) for the selection
  useEffect(() => {
    const chosen = available.filter((a) => selectedIds.has(a.id))
    if (chosen.length === 0) {
      setLabels([])
      return
    }
    setLabels(null)
    let cancelled = false
    void (async () => {
      const built: LabelData[] = []
      for (const item of chosen) {
        built.push({ ...item, qr: await qrDataUrl(item.code, 256) })
      }
      if (!cancelled) setLabels(built)
    })()
    return () => {
      cancelled = true
    }
  }, [available, selectedIds])

  const filtered = useMemo(
    () =>
      filter.trim()
        ? available.filter(
            (a) =>
              a.title.toLowerCase().includes(filter.toLowerCase()) ||
              a.code.toLowerCase().includes(filter.toLowerCase())
          )
        : available,
    [available, filter]
  )

  const repeated = useMemo(() => {
    if (!labels) return null
    const n = Math.max(1, Math.min(50, Math.trunc(Number(copies) || 1)))
    const out: LabelData[] = []
    for (const l of labels) for (let i = 0; i < n; i++) out.push(l)
    return out
  }, [labels, copies])

  const doPrint = (): void => {
    if (!repeated || repeated.length === 0) {
      toast('info', 'Select at least one item to print.')
      return
    }
    window.print()
  }

  const doPdf = async (): Promise<void> => {
    if (!repeated || repeated.length === 0) {
      toast('info', 'Select at least one item first.')
      return
    }
    const path = await window.osea.app.printToPdf(`osea-labels-${kind}.pdf`)
    if (path) {
      toast('success', `PDF saved to ${path}`)
      await window.osea.app.showInFolder(path)
    }
  }

  const toggleAll = (): void => {
    if (filtered.every((f) => selectedIds.has(f.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)))
    }
  }

  return (
    <div className="animate-fade-in">
      {/* dynamic page size for the active template */}
      <style>{`@media print { ${template.pageCss} }`}</style>

      <div className="no-print">
        <PageHeader
          title="Labels & QR Codes"
          subtitle="Every item already has its QR — print individually or in bulk, reprint any time"
          actions={
            <>
              <button className="btn-secondary" onClick={doPdf}>
                <FileDown size={15} /> Export PDF
              </button>
              <button className="btn-primary" onClick={doPrint}>
                <Printer size={15} /> Print
              </button>
            </>
          }
        />

        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          {/* Item picker */}
          <div className="card p-4">
            <div className="mb-3 flex rounded-lg border border-abyss-200 p-0.5 dark:border-abyss-700">
              {(
                [
                  ['asset', 'Rental assets'],
                  ['product', 'Retail products']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setKind(key)
                    setSelectedIds(new Set())
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold ${
                    kind === key ? 'bg-ocean-600 text-white' : 'text-abyss-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className="input mb-2"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="mb-2 text-xs font-semibold text-ocean-600 hover:underline dark:text-ocean-300" onClick={toggleAll}>
              {filtered.every((f) => selectedIds.has(f.id)) && filtered.length > 0
                ? 'Deselect all'
                : `Select all (${filtered.length})`}
            </button>
            <div className="max-h-[46vh] space-y-0.5 overflow-y-auto">
              {filtered.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-abyss-50 dark:hover:bg-abyss-800/50"
                >
                  <input
                    type="checkbox"
                    className="accent-ocean-600"
                    checked={selectedIds.has(item.id)}
                    onChange={() => {
                      const next = new Set(selectedIds)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      setSelectedIds(next)
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate font-mono text-xs text-abyss-400">{item.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Template + preview */}
          <div className="col-span-2 max-lg:col-span-1">
            <div className="card mb-4 p-4">
              <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      templateId === t.id
                        ? 'border-ocean-500 bg-ocean-50/60 dark:bg-ocean-900/20'
                        : 'border-abyss-200 hover:border-abyss-300 dark:border-abyss-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="mt-0.5 text-xs text-abyss-400">{t.hint}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-abyss-400">Copies per item:</span>
                <input
                  className="input !w-20"
                  type="number"
                  min="1"
                  max="50"
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                />
                <span className="ml-auto text-xs text-abyss-400">
                  {repeated ? `${repeated.length} label${repeated.length === 1 ? '' : 's'} ready` : 'Preparing…'}
                </span>
              </div>
            </div>

            {labels === null ? (
              <Spinner label="Generating QR codes…" />
            ) : repeated && repeated.length === 0 ? (
              <div className="card flex flex-col items-center px-6 py-14 text-abyss-400">
                <QrCode size={36} className="mb-3 opacity-40" />
                <p className="text-sm">Select items on the left to preview their labels.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Print area — visible preview on screen, exact layout on paper */}
      {repeated && repeated.length > 0 && (
        <div className="print-root mt-2">
          <div
            className={
              template.sheet
                ? 'mx-auto grid w-fit bg-white text-black shadow-card print:shadow-none'
                : 'mx-auto w-fit space-y-2 print:space-y-0'
            }
            style={template.sheet ? { gridTemplateColumns: `repeat(${template.cols}, ${template.labelW})` } : undefined}
          >
            {repeated.map((l, i) => (
              <div
                key={`${l.id}-${i}`}
                className="flex items-center gap-2 overflow-hidden border border-dashed border-abyss-200 bg-white p-[3mm] text-black print:border-0"
                style={{
                  width: template.labelW,
                  height: template.labelH,
                  pageBreakAfter: !template.sheet ? 'always' : undefined,
                  breakInside: 'avoid'
                }}
              >
                <img src={l.qr} alt="" style={{ width: template.qrPx, height: template.qrPx }} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[10px] font-bold uppercase tracking-wide text-abyss-500">
                    {settings?.businessName ?? 'OSEA Dive Manager'}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold">{l.title}</div>
                  {l.subtitle && <div className="truncate text-[9px] text-abyss-500">{l.subtitle}</div>}
                  <div className="mt-0.5 font-mono text-[11px] font-bold">{l.code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
