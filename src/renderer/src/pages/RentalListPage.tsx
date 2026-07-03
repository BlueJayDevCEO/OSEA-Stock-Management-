import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Anchor, Plus, Printer, Search } from 'lucide-react'
import type { Brand, EquipmentType, RentalAsset, RentalStatus } from '@shared/types'
import { RENTAL_STATUSES, RENTAL_STATUS_LABELS } from '@shared/types'
import { money } from '@renderer/lib/format'
import { DataTable, type Column } from '@renderer/components/DataTable'
import { ConditionBadge, RentalStatusBadge } from '@renderer/components/StatusBadge'
import { EmptyState, PageHeader, Spinner } from '@renderer/components/ui'
import { AssetForm } from '@renderer/components/AssetForm'

export function RentalListPage(): JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [assets, setAssets] = useState<RentalAsset[] | null>(null)
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)

  const status = (params.get('status') as RentalStatus | null) ?? 'all'

  const load = useCallback(async () => {
    const list = await window.osea.assets.list({
      search: search || undefined,
      status: status as RentalStatus | 'all',
      equipmentTypeId: typeId || undefined,
      brandId: brandId || undefined
    })
    setAssets(list)
  }, [search, status, typeId, brandId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void window.osea.catalog.listEquipmentTypes().then(setTypes)
    void window.osea.catalog.listBrands().then(setBrands)
  }, [])

  const columns = useMemo<Column<RentalAsset>[]>(
    () => [
      {
        key: 'assetNumber',
        label: 'Asset',
        sortValue: (a) => a.assetNumber,
        render: (a) => <span className="font-mono text-xs font-semibold">{a.assetNumber}</span>
      },
      {
        key: 'type',
        label: 'Type',
        sortValue: (a) => a.equipmentTypeName ?? '',
        render: (a) => <span className="font-medium">{a.equipmentTypeName ?? '—'}</span>
      },
      {
        key: 'item',
        label: 'Brand / Model',
        sortValue: (a) => `${a.brandName ?? ''} ${a.model ?? ''}`,
        render: (a) => (
          <span>
            {a.brandName && <span>{a.brandName} </span>}
            <span className="text-abyss-500 dark:text-abyss-400">{a.model ?? ''}</span>
          </span>
        )
      },
      {
        key: 'size',
        label: 'Size',
        sortValue: (a) => a.size ?? '',
        render: (a) => a.size ?? '—'
      },
      {
        key: 'status',
        label: 'Status',
        sortValue: (a) => a.status,
        render: (a) => (
          <div className="flex flex-col gap-0.5">
            <RentalStatusBadge status={a.status} />
            {a.status === 'checked_out' && a.currentRenter && (
              <span className="text-xs text-abyss-400">{a.currentRenter}</span>
            )}
          </div>
        )
      },
      {
        key: 'condition',
        label: 'Condition',
        sortValue: (a) => a.condition,
        render: (a) => <ConditionBadge condition={a.condition} />
      },
      {
        key: 'value',
        label: 'Value',
        align: 'right',
        sortValue: (a) => a.replacementValue ?? a.purchasePrice ?? 0,
        render: (a) => money(a.replacementValue ?? a.purchasePrice)
      }
    ],
    []
  )

  const setStatusFilter = (value: string): void => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rental Equipment"
        subtitle={assets ? `${assets.length} assets in view` : undefined}
        actions={
          <>
            {selected.size > 0 && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/labels?kind=asset&ids=${[...selected].join(',')}`)}
              >
                <Printer size={15} /> Print {selected.size} label{selected.size > 1 ? 's' : ''}
              </button>
            )}
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add equipment
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-abyss-400" />
          <input
            className="input !pl-9"
            placeholder="Search asset number, serial, brand, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input !w-44" value={status} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {RENTAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {RENTAL_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input !w-44" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="input !w-40" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {!assets ? (
        <Spinner />
      ) : assets.length === 0 && !search && status === 'all' && !typeId && !brandId ? (
        <EmptyState
          icon={<Anchor size={40} />}
          title="Your rental fleet starts here"
          message="Add your BCDs, regulators, cylinders, wetsuits and more. Every asset gets its own number, QR code and full history."
          action={
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add your first asset
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={assets}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/rental/${a.id}`)}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          emptyMessage="No assets match these filters."
        />
      )}

      <AssetForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )
}
