import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeEuro,
  BarChart3,
  FileDown,
  PackageX,
  Printer,
  Receipt,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Waves,
  Wrench
} from 'lucide-react'
import type { ReportRequest, ReportResult } from '@shared/types'
import { formatDate, formatDateTime, money, todayIsoDate } from '@renderer/lib/format'
import { useApp } from '@renderer/lib/store'
import { PageHeader, Spinner } from '@renderer/components/ui'

const REPORTS: Array<{
  id: ReportRequest['report']
  name: string
  description: string
  icon: JSX.Element
  dated?: boolean
}> = [
  { id: 'inventory_value', name: 'Inventory Value', description: 'Fleet and shop value by group', icon: <BadgeEuro size={17} /> },
  { id: 'rental_utilisation', name: 'Rental Utilisation', description: 'Fleet usage by equipment type', icon: <Waves size={17} />, dated: true },
  { id: 'equipment_status', name: 'Equipment Status', description: 'Every asset and where it is', icon: <BarChart3 size={17} /> },
  { id: 'service_due', name: 'Service Due', description: 'Upcoming and overdue servicing', icon: <Wrench size={17} /> },
  { id: 'sales', name: 'Sales', description: 'Every sale in a period', icon: <Receipt size={17} />, dated: true },
  { id: 'profit', name: 'Profit by Product', description: 'Revenue, cost and margin', icon: <TrendingUp size={17} />, dated: true },
  { id: 'supplier', name: 'Suppliers', description: 'Spend and items by supplier', icon: <Users size={17} /> },
  { id: 'purchases', name: 'Purchase Orders', description: 'Ordering activity and value', icon: <Truck size={17} />, dated: true },
  { id: 'damage', name: 'Damage Reports', description: 'Damage events in a period', icon: <ShieldAlert size={17} />, dated: true },
  { id: 'low_stock', name: 'Low Stock', description: 'Products at or below minimum', icon: <TriangleAlert size={17} /> },
  { id: 'out_of_stock', name: 'Out of Stock', description: 'Products with zero stock', icon: <PackageX size={17} /> }
]

function defaultFrom(): string {
  return new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
}

export function ReportsPage(): JSX.Element {
  const [params] = useSearchParams()
  const toast = useApp((s) => s.toast)
  const [reportId, setReportId] = useState<ReportRequest['report']>(
    (params.get('report') as ReportRequest['report'] | null) ?? 'inventory_value'
  )
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(todayIsoDate())
  const [result, setResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)

  const meta = REPORTS.find((r) => r.id === reportId)!

  const run = useCallback(async () => {
    setLoading(true)
    try {
      setResult(
        await window.osea.reports.run({
          report: reportId,
          from: meta.dated ? from : undefined,
          to: meta.dated ? to : undefined
        })
      )
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Report failed.')
    } finally {
      setLoading(false)
    }
  }, [reportId, from, to, meta.dated, toast])

  useEffect(() => {
    void run()
  }, [run])

  const exportCsv = async (): Promise<void> => {
    if (!result) return
    const path = await window.osea.app.chooseSavePath(
      `osea-report-${reportId}.csv`,
      'CSV file',
      ['csv']
    )
    if (!path) return
    await window.osea.data.exportCsv(path, result.columns, result.rows)
    toast('success', `Report exported to ${path}`)
    await window.osea.app.showInFolder(path)
  }

  const fmt = (value: string | number | null, format?: string): string => {
    if (value === null || value === undefined || value === '') return '—'
    switch (format) {
      case 'money':
        return money(Number(value))
      case 'percent':
        return `${value}%`
      case 'date':
        return formatDate(String(value))
      default:
        return String(value)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="no-print">
        <PageHeader
          title="Reports"
          subtitle="Everything exports to CSV and prints cleanly"
          actions={
            <>
              <button className="btn-secondary" onClick={exportCsv} disabled={!result}>
                <FileDown size={15} /> Export CSV
              </button>
              <button className="btn-secondary" onClick={() => window.print()} disabled={!result}>
                <Printer size={15} /> Print
              </button>
            </>
          }
        />

        <div className="mb-4 grid grid-cols-6 gap-2 max-xl:grid-cols-4 max-md:grid-cols-2">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => setReportId(r.id)}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${
                reportId === r.id
                  ? 'border-ocean-500 bg-ocean-50/60 dark:bg-ocean-900/20'
                  : 'border-abyss-200 hover:border-abyss-300 dark:border-abyss-700'
              }`}
              title={r.description}
            >
              <span className="text-ocean-600 dark:text-ocean-300">{r.icon}</span>
              <div className="mt-1.5 text-xs font-semibold leading-tight">{r.name}</div>
            </button>
          ))}
        </div>

        {meta.dated && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-abyss-400">From</span>
            <input className="input !w-40" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-abyss-400">to</span>
            <input className="input !w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {loading || !result ? (
        <Spinner label="Running report…" />
      ) : (
        <div className="print-root">
          <div className="mb-3 hidden print:block">
            <h1 className="text-lg font-bold">{result.title}</h1>
            <p className="text-xs text-abyss-500">Generated {formatDateTime(result.generatedAt)}</p>
          </div>

          {result.summary && result.summary.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3">
              {result.summary.map((s) => (
                <div key={s.label} className="card px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-abyss-400">{s.label}</div>
                  <div className="text-lg font-bold tabular-nums">
                    {Number.isFinite(Number(s.value)) ? money(Number(s.value)) : s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden print:border-0 print:shadow-none">
            <div className="max-h-[60vh] overflow-auto print:max-h-none">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th
                        key={c.key}
                        className={`table-head px-4 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length} className="px-4 py-10 text-center text-abyss-400">
                        Nothing to report for this selection.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-abyss-100 last:border-0 dark:border-abyss-800/50">
                        {result.columns.map((c) => (
                          <td
                            key={c.key}
                            className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                          >
                            {fmt(row[c.key] ?? null, c.format)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
