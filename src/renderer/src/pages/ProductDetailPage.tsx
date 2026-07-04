import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowDownUp, ArrowLeft, Pencil, Printer } from 'lucide-react'
import type { CustomFieldValue, MovementType, Product, StockMovement } from '@shared/types'
import { MOVEMENT_TYPE_LABELS } from '@shared/types'
import { formatDateTime, money } from '@renderer/lib/format'
import { qrDataUrl } from '@renderer/lib/qr'
import { useApp } from '@renderer/lib/store'
import { StockBadge } from '@renderer/components/StatusBadge'
import { Field, Modal, PageHeader, Spinner } from '@renderer/components/ui'
import { ProductForm } from '@renderer/components/ProductForm'

const ADJUSTABLE_TYPES: MovementType[] = [
  'delivery',
  'adjustment',
  'damage',
  'customer_return',
  'transfer',
  'loss'
]

/** Movement directions: which types add stock vs remove it. */
const ADDS_STOCK: Record<string, boolean> = {
  delivery: true,
  customer_return: true,
  adjustment: true, // sign chosen by user
  damage: false,
  transfer: false,
  loss: false
}

export function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)

  const [product, setProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [customValues, setCustomValues] = useState<CustomFieldValue[]>([])
  const [qr, setQr] = useState('')
  const [editOpen, setEditOpen] = useState(false)

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [movementType, setMovementType] = useState<MovementType>('delivery')
  const [qty, setQty] = useState('1')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const p = await window.osea.products.get(id)
    setProduct(p)
    if (p) {
      setMovements(await window.osea.products.movements(p.id))
      setCustomValues(await window.osea.custom.values('product', p.id))
      setQr(await qrDataUrl(p.sku))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const applyAdjustment = async (): Promise<void> => {
    if (!product) return
    const n = Math.abs(Math.trunc(Number(qty)))
    if (!n) {
      toast('error', 'Enter a quantity.')
      return
    }
    const isIn = movementType === 'adjustment' ? direction === 'in' : ADDS_STOCK[movementType]
    try {
      await window.osea.products.adjust({
        productId: product.id,
        movementType,
        qtyChange: isIn ? n : -n,
        reference: reference || null,
        notes: notes || null,
        staffName: settings?.staffName || null
      })
      toast('success', 'Stock movement recorded')
      setAdjustOpen(false)
      setQty('1')
      setReference('')
      setNotes('')
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not adjust stock.')
    }
  }

  const archiveProduct = async (): Promise<void> => {
    if (!product) return
    try {
      await window.osea.products.setArchived(product.id, true)
      toast('success', `${product.sku} moved to archive`)
      navigate('/archive')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not archive retail product.')
    }
  }

  const setCustomValue = async (fieldId: string, value: string): Promise<void> => {
    if (!product) return
    await window.osea.custom.setValue(fieldId, product.id, value || null)
    setCustomValues(await window.osea.custom.values('product', product.id))
  }

  if (!product) return <Spinner label="Loading product…" />

  const margin =
    product.retailPrice > 0
      ? Math.round(((product.retailPrice - product.costPrice) / product.retailPrice) * 1000) / 10
      : 0

  return (
    <div className="animate-fade-in">
      <Link to="/retail" className="mb-3 inline-flex items-center gap-1.5 text-sm text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200">
        <ArrowLeft size={15} /> Retail shop
      </Link>

      <PageHeader
        title={product.name}
        subtitle={`${product.brandName ? product.brandName + ' · ' : ''}SKU ${product.sku}`}
        actions={
          <>
            {!product.archived && (
              <button className="btn-secondary" onClick={() => void archiveProduct()}>
                <Archive size={15} /> Archive
              </button>
            )}
            <button className="btn-secondary" onClick={() => navigate(`/labels?kind=product&ids=${product.id}`)}>
              <Printer size={15} /> Print label
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Edit
            </button>
            <button className="btn-primary" onClick={() => setAdjustOpen(true)}>
              <ArrowDownUp size={15} /> Adjust stock
            </button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <StockBadge qty={product.stockQty} min={product.minStock} />
              <div className="mt-3 text-3xl font-bold tabular-nums">{product.stockQty}</div>
              <div className="text-xs text-abyss-400">
                units on hand · min {product.minStock}
                {product.maxStock != null ? ` · max ${product.maxStock}` : ''}
              </div>
            </div>
            {qr && (
              <img
                src={qr}
                alt={`QR code for ${product.sku}`}
                className="h-24 w-24 rounded-lg border border-abyss-200 bg-white p-1 dark:border-abyss-700"
              />
            )}
          </div>

          <dl className="mt-5 space-y-2 text-sm">
            {[
              ['Barcode', product.barcode],
              ['Category', product.categoryName],
              ['Supplier', product.supplierName],
              ['Shelf location', product.shelfLocation],
              ['Cost price', money(product.costPrice)],
              ['Retail price', money(product.retailPrice)],
              ['VAT rate', `${product.vatRate}%`],
              ['Margin', `${margin}%`],
              ['Stock value (cost)', money(product.stockQty * product.costPrice)]
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-abyss-400">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>

          {customValues.length > 0 && (
            <div className="mt-4 border-t border-abyss-200/70 pt-4 dark:border-abyss-800/60">
              <div className="label">Custom fields</div>
              <div className="space-y-2">
                {customValues.map((cv) => (
                  <div key={cv.fieldId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-abyss-400">{cv.fieldName}</span>
                    {cv.fieldType === 'select' ? (
                      <select
                        className="input !w-40 !py-1 !text-xs"
                        value={cv.value ?? ''}
                        onChange={(e) => void setCustomValue(cv.fieldId, e.target.value)}
                      >
                        <option value="">—</option>
                        {cv.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input !w-40 !py-1 !text-xs"
                        type={cv.fieldType === 'number' ? 'number' : cv.fieldType === 'date' ? 'date' : 'text'}
                        defaultValue={cv.value ?? ''}
                        onBlur={(e) => void setCustomValue(cv.fieldId, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.description && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-abyss-50 p-3 text-sm text-abyss-600 dark:bg-abyss-800/50 dark:text-abyss-300">
              {product.description}
            </p>
          )}
        </div>

        <div className="card col-span-2 max-lg:col-span-1">
          <div className="border-b border-abyss-200/70 px-5 py-4 dark:border-abyss-800/60">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-abyss-400">
              Stock movement history
            </h3>
          </div>
          <div className="max-h-[62vh] overflow-y-auto">
            {movements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-abyss-400">No movements yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-head px-5 py-2.5">When</th>
                    <th className="table-head px-4 py-2.5">Type</th>
                    <th className="table-head px-4 py-2.5 text-right">Change</th>
                    <th className="table-head px-4 py-2.5 text-right">After</th>
                    <th className="table-head px-4 py-2.5">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-abyss-100 last:border-0 dark:border-abyss-800/50">
                      <td className="px-5 py-2.5 text-xs text-abyss-500 dark:text-abyss-400">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">{MOVEMENT_TYPE_LABELS[m.movementType]}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                          m.qtyChange > 0 ? 'text-reef-600 dark:text-reef-300' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {m.qtyChange > 0 ? '+' : ''}
                        {m.qtyChange}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{m.qtyAfter}</td>
                      <td className="px-4 py-2.5 text-xs text-abyss-500 dark:text-abyss-400">
                        {[m.reference, m.notes].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Adjust stock modal */}
      <Modal
        open={adjustOpen}
        title={`Adjust stock — ${product.name}`}
        onClose={() => setAdjustOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdjustOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={applyAdjustment}>
              Record movement
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Movement type">
            <select
              className="input"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as MovementType)}
            >
              {ADJUSTABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              className="input"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          {movementType === 'adjustment' && (
            <Field label="Direction">
              <select
                className="input"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              >
                <option value="in">Add stock (+)</option>
                <option value="out">Remove stock (−)</option>
              </select>
            </Field>
          )}
          <Field label="Reference" hint="Delivery note, ticket number…">
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Notes" className="col-span-2 max-sm:col-span-1">
            <textarea
              className="input min-h-[56px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-abyss-400">
          Stock never changes silently — every adjustment is recorded in the movement history.
        </p>
      </Modal>

      <ProductForm open={editOpen} product={product} onClose={() => setEditOpen(false)} onSaved={load} />
    </div>
  )
}
