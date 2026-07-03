import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Truck } from 'lucide-react'
import type { PoStatus, Product, PurchaseOrder, Supplier } from '@shared/types'
import { PO_STATUSES, PO_STATUS_LABELS } from '@shared/types'
import { formatDate, money } from '@renderer/lib/format'
import { useApp } from '@renderer/lib/store'
import { DataTable, type Column } from '@renderer/components/DataTable'
import { PoStatusBadge } from '@renderer/components/StatusBadge'
import { EmptyState, Field, Modal, PageHeader, Spinner } from '@renderer/components/ui'

interface DraftLine {
  productId: string
  qtyOrdered: number
  unitCost: number
}

export function PurchaseOrdersPage(): JSX.Element {
  const navigate = useNavigate()
  const toast = useApp((s) => s.toast)
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null)
  const [status, setStatus] = useState<PoStatus | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setOrders(await window.osea.po.list(status))
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = async (): Promise<void> => {
    const [s, p] = await Promise.all([
      window.osea.catalog.listSuppliers(),
      window.osea.products.list()
    ])
    setSuppliers(s)
    setProducts(p)
    setSupplierId('')
    setExpectedDate('')
    setNotes('')
    setLines([])
    setCreateOpen(true)
  }

  const supplierProducts = useMemo(
    () => (supplierId ? products.filter((p) => p.supplierId === supplierId) : products),
    [products, supplierId]
  )

  const addLine = (): void => {
    const candidates = supplierProducts.filter((p) => !lines.some((l) => l.productId === p.id))
    const first = candidates[0]
    if (!first) {
      toast('info', 'Every product is already on this order.')
      return
    }
    setLines((l) => [...l, { productId: first.id, qtyOrdered: 1, unitCost: first.costPrice }])
  }

  /** One-click restock: pre-fill lines for everything at/below minimum. */
  const addLowStock = (): void => {
    const low = supplierProducts.filter(
      (p) => p.stockQty <= p.minStock && !lines.some((l) => l.productId === p.id)
    )
    if (low.length === 0) {
      toast('info', 'No low-stock products for this supplier.')
      return
    }
    setLines((l) => [
      ...l,
      ...low.map((p) => ({
        productId: p.id,
        qtyOrdered: Math.max(1, (p.maxStock ?? p.minStock * 2) - p.stockQty),
        unitCost: p.costPrice
      }))
    ])
  }

  const updateLine = (i: number, patch: Partial<DraftLine>): void =>
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, ...patch } : line)))

  const create = async (): Promise<void> => {
    if (lines.length === 0) {
      toast('error', 'Add at least one product line.')
      return
    }
    setBusy(true)
    try {
      const po = await window.osea.po.create({
        supplierId: supplierId || null,
        expectedDate: expectedDate || null,
        notes: notes || null,
        lines
      })
      toast('success', `Purchase order ${po.poNumber} created as draft`)
      setCreateOpen(false)
      await load()
      navigate(`/purchase-orders/${po.id}`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not create the purchase order.')
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo<Column<PurchaseOrder>[]>(
    () => [
      {
        key: 'number',
        label: 'PO',
        sortValue: (po) => po.poNumber,
        render: (po) => <span className="font-mono text-xs font-semibold">{po.poNumber}</span>
      },
      {
        key: 'supplier',
        label: 'Supplier',
        sortValue: (po) => po.supplierName ?? '',
        render: (po) => po.supplierName ?? '—'
      },
      {
        key: 'status',
        label: 'Status',
        sortValue: (po) => po.status,
        render: (po) => <PoStatusBadge status={po.status} />
      },
      {
        key: 'ordered',
        label: 'Ordered',
        sortValue: (po) => po.orderDate,
        render: (po) => formatDate(po.orderDate)
      },
      {
        key: 'expected',
        label: 'Expected',
        sortValue: (po) => po.expectedDate ?? '',
        render: (po) => formatDate(po.expectedDate)
      },
      {
        key: 'lines',
        label: 'Lines',
        align: 'right',
        sortValue: (po) => po.lines.length,
        render: (po) => po.lines.length
      },
      {
        key: 'value',
        label: 'Value',
        align: 'right',
        sortValue: (po) => po.totalCost,
        render: (po) => <span className="font-semibold">{money(po.totalCost)}</span>
      }
    ],
    []
  )

  const totalDraft = lines.reduce((a, l) => a + l.qtyOrdered * l.unitCost, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Purchase Orders"
        subtitle="Receiving stock updates inventory automatically"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> New purchase order
          </button>
        }
      />

      <div className="mb-4 flex gap-1.5">
        {(['all', ...PO_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              status === s
                ? 'bg-ocean-600 text-white'
                : 'bg-abyss-100 text-abyss-500 hover:bg-abyss-200 dark:bg-abyss-800 dark:text-abyss-300'
            }`}
          >
            {s === 'all' ? 'All' : PO_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {!orders ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Truck size={40} />}
          title="No purchase orders"
          message="Create a purchase order to restock. Receiving deliveries updates stock levels and cost prices automatically."
          action={
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> New purchase order
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(po) => po.id}
          onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
        />
      )}

      {/* Create PO modal */}
      <Modal
        open={createOpen}
        title="New purchase order"
        onClose={() => setCreateOpen(false)}
        wide
        footer={
          <>
            <span className="mr-auto self-center text-sm text-abyss-400">
              Total: <span className="font-semibold text-abyss-800 dark:text-abyss-100">{money(totalDraft)}</span>
            </span>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={create} disabled={busy}>
              {busy ? 'Creating…' : 'Create draft'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
          <Field label="Supplier">
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Any / mixed</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected delivery">
            <input
              className="input"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="label !mb-0">Order lines</div>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1.5 !text-xs" onClick={addLowStock}>
              Add all low-stock items
            </button>
            <button className="btn-secondary !py-1.5 !text-xs" onClick={addLine}>
              <Plus size={13} /> Add line
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {lines.length === 0 && (
            <p className="rounded-lg border border-dashed border-abyss-300 px-4 py-6 text-center text-sm text-abyss-400 dark:border-abyss-700">
              No lines yet — add products to order.
            </p>
          )}
          {lines.map((line, i) => {
            const product = products.find((p) => p.id === line.productId)
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={line.productId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value)
                    updateLine(i, { productId: e.target.value, unitCost: p?.costPrice ?? 0 })
                  }}
                >
                  {supplierProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {p.stockQty} in stock
                    </option>
                  ))}
                </select>
                <input
                  className="input !w-20"
                  type="number"
                  min="1"
                  value={line.qtyOrdered}
                  onChange={(e) => updateLine(i, { qtyOrdered: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Quantity"
                />
                <input
                  className="input !w-28"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) => updateLine(i, { unitCost: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label="Unit cost"
                />
                <span className="w-20 text-right text-sm font-semibold tabular-nums">
                  {money(line.qtyOrdered * line.unitCost)}
                </span>
                <button
                  className="btn-ghost !p-1.5 text-red-500"
                  onClick={() => setLines((l) => l.filter((_, idx) => idx !== i))}
                  aria-label="Remove line"
                >
                  <Trash2 size={14} />
                </button>
                {product && product.stockQty <= product.minStock && (
                  <span className="sr-only">low stock</span>
                )}
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
