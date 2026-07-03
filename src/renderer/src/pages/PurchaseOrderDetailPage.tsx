import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, PackageCheck, Send, Trash2, X } from 'lucide-react'
import type { PurchaseOrder } from '@shared/types'
import { formatDate, formatDateTime, money } from '@renderer/lib/format'
import { useApp } from '@renderer/lib/store'
import { PoStatusBadge } from '@renderer/components/StatusBadge'
import { ConfirmDialog, Modal, PageHeader, Spinner } from '@renderer/components/ui'

export function PurchaseOrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useApp((s) => s.toast)
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receipts, setReceipts] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setPo(await window.osea.po.get(id))
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!po) return <Spinner label="Loading purchase order…" />

  const outstanding = po.lines.some((l) => l.qtyReceived < l.qtyOrdered)

  const setStatus = async (status: 'sent' | 'cancelled' | 'completed'): Promise<void> => {
    try {
      await window.osea.po.updateStatus(po.id, status)
      toast('success', `${po.poNumber} marked as ${status}`)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not update the order.')
    }
  }

  const openReceive = (): void => {
    const init: Record<string, string> = {}
    for (const l of po.lines) init[l.id] = String(Math.max(0, l.qtyOrdered - l.qtyReceived))
    setReceipts(init)
    setReceiveOpen(true)
  }

  const receive = async (): Promise<void> => {
    try {
      const payload = Object.entries(receipts)
        .map(([lineId, v]) => ({ lineId, qtyReceived: Math.max(0, Math.trunc(Number(v) || 0)) }))
        .filter((r) => r.qtyReceived > 0)
      if (payload.length === 0) {
        toast('error', 'Enter at least one received quantity.')
        return
      }
      const updated = await window.osea.po.receive(po.id, payload)
      toast(
        'success',
        updated.status === 'completed'
          ? `${po.poNumber} fully received — stock updated`
          : `Delivery recorded — ${po.poNumber} is partially received`
      )
      setReceiveOpen(false)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not receive stock.')
    }
  }

  const deleteDraft = async (): Promise<void> => {
    await window.osea.po.deleteDraft(po.id)
    toast('success', `${po.poNumber} deleted`)
    navigate('/purchase-orders')
  }

  return (
    <div className="animate-fade-in">
      <Link
        to="/purchase-orders"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200"
      >
        <ArrowLeft size={15} /> Purchase orders
      </Link>

      <PageHeader
        title={`Purchase order ${po.poNumber}`}
        subtitle={`${po.supplierName ?? 'No supplier'} · ordered ${formatDate(po.orderDate)}${po.expectedDate ? ` · expected ${formatDate(po.expectedDate)}` : ''}`}
        actions={
          <>
            {po.status === 'draft' && (
              <>
                <button className="btn-ghost text-red-500" onClick={() => setConfirm('delete')}>
                  <Trash2 size={15} /> Delete draft
                </button>
                <button className="btn-primary" onClick={() => void setStatus('sent')}>
                  <Send size={15} /> Mark as sent
                </button>
              </>
            )}
            {(po.status === 'sent' || po.status === 'partial') && (
              <>
                <button className="btn-ghost text-red-500" onClick={() => setConfirm('cancel')}>
                  <X size={15} /> Cancel order
                </button>
                {outstanding && (
                  <button className="btn-primary" onClick={openReceive}>
                    <PackageCheck size={15} /> Receive delivery
                  </button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <PoStatusBadge status={po.status} />
        <span className="text-sm text-abyss-400">
          Created {formatDateTime(po.createdAt)} · {po.lines.length} line{po.lines.length === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold text-abyss-700 dark:text-abyss-200">{money(po.totalCost)}</span>
        </span>
      </div>

      {po.notes && (
        <p className="card mb-4 p-4 text-sm text-abyss-600 dark:text-abyss-300">{po.notes}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-head px-5 py-3">Product</th>
              <th className="table-head px-4 py-3 text-right">Ordered</th>
              <th className="table-head px-4 py-3 text-right">Received</th>
              <th className="table-head px-4 py-3 text-right">Unit cost</th>
              <th className="table-head px-4 py-3 text-right">Line total</th>
              <th className="table-head px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const pct = l.qtyOrdered > 0 ? Math.min(100, (l.qtyReceived / l.qtyOrdered) * 100) : 0
              return (
                <tr key={l.id} className="border-b border-abyss-100 last:border-0 dark:border-abyss-800/50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{l.productName}</div>
                    <div className="font-mono text-xs text-abyss-400">{l.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.qtyOrdered}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={l.qtyReceived >= l.qtyOrdered ? 'font-semibold text-reef-600 dark:text-reef-300' : ''}>
                      {l.qtyReceived}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(l.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(l.qtyOrdered * l.unitCost)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-abyss-100 dark:bg-abyss-800">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? 'bg-reef-500' : 'bg-ocean-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {pct >= 100 && <Check size={14} className="text-reef-500" />}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Receive modal */}
      <Modal
        open={receiveOpen}
        title={`Receive delivery — ${po.poNumber}`}
        onClose={() => setReceiveOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReceiveOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={receive}>
              <PackageCheck size={15} /> Receive & update stock
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm text-abyss-500 dark:text-abyss-400">
          Enter what actually arrived. Partial deliveries are fine — the order stays open until
          every line is complete.
        </p>
        <div className="space-y-3">
          {po.lines.map((l) => {
            const remaining = l.qtyOrdered - l.qtyReceived
            return (
              <div key={l.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.productName}</div>
                  <div className="text-xs text-abyss-400">
                    {remaining > 0 ? `${remaining} outstanding` : 'Complete'}
                  </div>
                </div>
                <input
                  className="input !w-24"
                  type="number"
                  min="0"
                  max={remaining}
                  value={receipts[l.id] ?? '0'}
                  onChange={(e) => setReceipts((r) => ({ ...r, [l.id]: e.target.value }))}
                  disabled={remaining <= 0}
                  aria-label={`Quantity received for ${l.productName}`}
                />
              </div>
            )
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this purchase order?"
        message={`${po.poNumber} will be marked as cancelled. Stock already received stays in inventory.`}
        confirmLabel="Cancel order"
        danger
        onConfirm={() => {
          setConfirm(null)
          void setStatus('cancelled')
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this draft?"
        message={`Draft ${po.poNumber} will be permanently removed.`}
        confirmLabel="Delete draft"
        danger
        onConfirm={() => {
          setConfirm(null)
          void deleteDraft()
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
