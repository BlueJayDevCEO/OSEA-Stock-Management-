import type {
  PoStatus,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderLine,
  ReceiveLineInput
} from '@shared/types'
import { getDb } from '../db'
import { newId, nextNumber, nowIso } from '../db/ids'
import { applyMovement } from './products'
import { getSettings } from './settings'

interface PoRow {
  id: string
  po_number: string
  supplier_id: string | null
  supplier_name: string | null
  status: PoStatus
  order_date: string
  expected_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface PoLineRow {
  id: string
  po_id: string
  product_id: string
  product_name: string
  sku: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
}

function mapLine(r: PoLineRow): PurchaseOrderLine {
  return {
    id: r.id,
    poId: r.po_id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    qtyOrdered: r.qty_ordered,
    qtyReceived: r.qty_received,
    unitCost: r.unit_cost
  }
}

function loadLines(poId: string): PurchaseOrderLine[] {
  const db = getDb()
  return db
    .all<PoLineRow>(
      `SELECT l.*, p.name AS product_name, p.sku AS sku
       FROM purchase_order_lines l JOIN products p ON p.id = l.product_id
       WHERE l.po_id = ?`,
      [poId]
    )
    .map(mapLine)
}

function mapPo(r: PoRow): PurchaseOrder {
  const lines = loadLines(r.id)
  return {
    id: r.id,
    poNumber: r.po_number,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    status: r.status,
    orderDate: r.order_date,
    expectedDate: r.expected_date,
    notes: r.notes,
    lines,
    totalCost: Math.round(lines.reduce((acc, l) => acc + l.qtyOrdered * l.unitCost, 0) * 100) / 100,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

const PO_SELECT = `
  SELECT po.*, s.name AS supplier_name
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
`

export function listPurchaseOrders(status?: PoStatus | 'all', page = 1, limit = 1000): PurchaseOrder[] {
  const db = getDb()
  const offset = (page - 1) * limit
  const rows =
    status && status !== 'all'
      ? db.all<PoRow>(`${PO_SELECT} WHERE po.status = ? AND po.archived = 0 ORDER BY po.created_at DESC LIMIT ? OFFSET ?`, [status, limit, offset])
      : db.all<PoRow>(`${PO_SELECT} WHERE po.archived = 0 ORDER BY po.created_at DESC LIMIT ? OFFSET ?`, [limit, offset])
  return rows.map(mapPo)
}

export function getPurchaseOrder(id: string): PurchaseOrder | null {
  const row = getDb().get<PoRow>(`${PO_SELECT} WHERE po.id = ?`, [id])
  return row ? mapPo(row) : null
}

export function createPurchaseOrder(input: PurchaseOrderInput): PurchaseOrder {
  const db = getDb()
  const settings = getSettings()
  if (!input.lines || input.lines.length === 0)
    throw new Error('A purchase order needs at least one line.')

  let id = ''
  db.transaction(() => {
    id = newId()
    const ts = nowIso()
    const poNumber = nextNumber(db, 'po', settings.poPrefix, 4)
    db.run(
      `INSERT INTO purchase_orders (id, po_number, supplier_id, status, order_date, expected_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
      [id, poNumber, input.supplierId ?? null, ts.slice(0, 10), input.expectedDate ?? null, input.notes ?? null, ts, ts]
    )
    for (const line of input.lines) {
      const qty = Math.max(1, Math.trunc(line.qtyOrdered))
      db.run(
        `INSERT INTO purchase_order_lines (id, po_id, product_id, qty_ordered, qty_received, unit_cost)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [newId(), id, line.productId, qty, Math.max(0, line.unitCost)]
      )
    }
  })
  return getPurchaseOrder(id)!
}

export function updatePoStatus(id: string, status: PoStatus): PurchaseOrder {
  const db = getDb()
  const po = getPurchaseOrder(id)
  if (!po) throw new Error('Purchase order not found.')

  const allowed: Record<PoStatus, PoStatus[]> = {
    draft: ['sent', 'cancelled'],
    sent: ['partial', 'completed', 'cancelled'],
    partial: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  }
  if (!allowed[po.status].includes(status))
    throw new Error(`A ${po.status} purchase order cannot move to ${status}.`)

  db.run('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    nowIso(),
    id
  ])
  return getPurchaseOrder(id)!
}

/**
 * Receive a delivery against a sent/partial PO. Stock levels and cost
 * prices update automatically; each received line writes a 'po_receipt'
 * movement referencing the PO number.
 */
export function receivePurchaseOrder(id: string, receipts: ReceiveLineInput[]): PurchaseOrder {
  const db = getDb()
  const po = getPurchaseOrder(id)
  if (!po) throw new Error('Purchase order not found.')
  if (po.status !== 'sent' && po.status !== 'partial')
    throw new Error('Only sent or partially received purchase orders can receive stock.')

  db.transaction(() => {
    for (const receipt of receipts) {
      const line = po.lines.find((l) => l.id === receipt.lineId)
      if (!line) continue
      const qty = Math.trunc(receipt.qtyReceived)
      if (qty <= 0) continue
      const remaining = line.qtyOrdered - line.qtyReceived
      const toReceive = Math.min(qty, remaining)
      if (toReceive <= 0) continue

      db.run('UPDATE purchase_order_lines SET qty_received = qty_received + ? WHERE id = ?', [
        toReceive,
        line.id
      ])
      // keep product cost price current with the latest paid cost
      if (line.unitCost > 0) {
        db.run('UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?', [
          line.unitCost,
          nowIso(),
          line.productId
        ])
      }
      applyMovement({
        productId: line.productId,
        movementType: 'po_receipt',
        qtyChange: toReceive,
        reference: po.poNumber,
        notes: `Received against ${po.poNumber}`
      })
    }

    const lines = loadLines(id)
    const complete = lines.every((l) => l.qtyReceived >= l.qtyOrdered)
    const any = lines.some((l) => l.qtyReceived > 0)
    const status: PoStatus = complete ? 'completed' : any ? 'partial' : po.status
    db.run('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      nowIso(),
      id
    ])
  })

  return getPurchaseOrder(id)!
}

export function deleteDraftPo(id: string): void {
  const db = getDb()
  const po = getPurchaseOrder(id)
  if (!po) return
  if (po.status !== 'draft') throw new Error('Only draft purchase orders can be deleted.')
  db.run('UPDATE purchase_orders SET archived = 1, updated_at = ? WHERE id = ?', [nowIso(), id])
}
