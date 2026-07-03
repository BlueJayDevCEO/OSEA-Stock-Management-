import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Anchor,
  BadgeEuro,
  Boxes,
  CalendarClock,
  PackageX,
  Receipt,
  TrendingUp,
  TriangleAlert,
  Wrench
} from 'lucide-react'
import type { DashboardStats } from '@shared/types'
import { RENTAL_STATUS_LABELS, type RentalStatus } from '@shared/types'
import { money, relativeTime } from '@renderer/lib/format'
import { PageHeader, Spinner, StatCard } from '@renderer/components/ui'
import { useApp } from '@renderer/lib/store'

const STATUS_COLORS: Record<string, string> = {
  available: '#07c5a7',
  reserved: '#8b5cf6',
  checked_out: '#1b99bd',
  returned: '#0ea5e9',
  cleaning: '#06b6d4',
  inspection: '#f59e0b',
  servicing: '#f97316',
  damaged: '#ef4444',
  lost: '#64748b',
  retired: '#94a3b8'
}

export function DashboardPage(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const navigate = useNavigate()
  const settings = useApp((s) => s.settings)

  useEffect(() => {
    void window.osea.reports.dashboard().then(setStats)
  }, [])

  if (!stats) return <Spinner label="Loading dashboard…" />

  const totalAssets = Math.max(1, stats.rentalAssetCount)
  const statusEntries = Object.entries(stats.rentalStatusCounts).sort((a, b) => b[1] - a[1])
  const maxDay = Math.max(1, ...stats.salesLast14Days.map((d) => d.total))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={settings?.businessName ?? 'Dashboard'}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      />

      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          label="Total Inventory Value"
          value={money(stats.rentalValueTotal + stats.retailStockValueCost)}
          sub={`Fleet ${money(stats.rentalValueTotal)} · Shop ${money(stats.retailStockValueCost)}`}
          icon={<BadgeEuro size={20} />}
          accent="ocean"
        />
        <StatCard
          label="Sales Today"
          value={money(stats.salesTodayTotal)}
          sub={`${stats.salesTodayCount} transaction${stats.salesTodayCount === 1 ? '' : 's'}`}
          icon={<Receipt size={20} />}
          accent="reef"
          onClick={() => navigate('/sales')}
        />
        <StatCard
          label="Sales This Month"
          value={money(stats.salesMonthTotal)}
          sub={`Profit ${money(stats.salesMonthProfit)}`}
          icon={<TrendingUp size={20} />}
          accent="reef"
          onClick={() => navigate('/reports')}
        />
        <StatCard
          label="Rental Fleet"
          value={String(stats.rentalAssetCount)}
          sub={`${stats.rentalStatusCounts['checked_out'] ?? 0} out with customers`}
          icon={<Anchor size={20} />}
          accent="ocean"
          onClick={() => navigate('/rental')}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <StatCard
          label="Low Stock"
          value={String(stats.lowStockCount)}
          sub="At or below minimum"
          icon={<TriangleAlert size={20} />}
          accent={stats.lowStockCount > 0 ? 'amber' : 'none'}
          onClick={() => navigate('/retail?stock=low')}
        />
        <StatCard
          label="Out of Stock"
          value={String(stats.outOfStockCount)}
          icon={<PackageX size={20} />}
          accent={stats.outOfStockCount > 0 ? 'red' : 'none'}
          onClick={() => navigate('/retail?stock=out')}
        />
        <StatCard
          label="Service Due"
          value={String(stats.serviceDueCount)}
          sub="Within 14 days"
          icon={<Wrench size={20} />}
          accent={stats.serviceDueCount > 0 ? 'amber' : 'none'}
          onClick={() => navigate('/reports?report=service_due')}
        />
        <StatCard
          label="Overdue Rentals"
          value={String(stats.overdueRentals)}
          sub="Past due-back date"
          icon={<CalendarClock size={20} />}
          accent={stats.overdueRentals > 0 ? 'red' : 'none'}
          onClick={() => navigate('/rental?status=checked_out')}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        {/* Sales, last 14 days */}
        <div className="card col-span-2 p-5 max-lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-abyss-400">
            Sales — last 14 days
          </h3>
          <div className="flex h-40 items-end gap-1.5">
            {stats.salesLast14Days.map((d) => (
              <div key={d.date} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-ocean-600 to-reef-500 transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(3, (d.total / maxDay) * 152)}px` }}
                />
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-abyss-950 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                  {money(d.total)} ·{' '}
                  {new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-abyss-400">
            <span>
              {new Date(stats.salesLast14Days[0].date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short'
              })}
            </span>
            <span>Today</span>
          </div>
        </div>

        {/* Fleet status breakdown */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-abyss-400">
            <Boxes size={15} /> Fleet status
          </h3>
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-abyss-100 dark:bg-abyss-800">
            {statusEntries.map(([status, count]) => (
              <div
                key={status}
                style={{
                  width: `${(count / totalAssets) * 100}%`,
                  backgroundColor: STATUS_COLORS[status] ?? '#94a3b8'
                }}
                title={`${RENTAL_STATUS_LABELS[status as RentalStatus] ?? status}: ${count}`}
              />
            ))}
          </div>
          <div className="space-y-2">
            {statusEntries.map(([status, count]) => (
              <button
                key={status}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-abyss-50 dark:hover:bg-abyss-800/50"
                onClick={() => navigate(`/rental?status=${status}`)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] ?? '#94a3b8' }}
                  />
                  {RENTAL_STATUS_LABELS[status as RentalStatus] ?? status}
                </span>
                <span className="font-semibold tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card mt-6 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-abyss-400">
          Recent activity
        </h3>
        {stats.recentActivity.length === 0 ? (
          <p className="py-6 text-center text-sm text-abyss-400">
            Activity will appear here as you rent, sell and receive stock.
          </p>
        ) : (
          <ul className="divide-y divide-abyss-100 dark:divide-abyss-800/60">
            {stats.recentActivity.map((a) => (
              <li key={`${a.kind}-${a.id}`} className="flex items-center gap-3 py-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    a.kind === 'sale'
                      ? 'bg-reef-500/10 text-reef-600 dark:text-reef-300'
                      : a.kind === 'rental_event'
                        ? 'bg-ocean-500/10 text-ocean-600 dark:text-ocean-300'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                  }`}
                >
                  {a.kind === 'sale' ? (
                    <Receipt size={15} />
                  ) : a.kind === 'rental_event' ? (
                    <Anchor size={15} />
                  ) : (
                    <Boxes size={15} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  {a.detail && <div className="truncate text-xs text-abyss-400">{a.detail}</div>}
                </div>
                <span className="shrink-0 text-xs text-abyss-400">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
