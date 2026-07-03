import type {
  PaymentMethod,
  Sale,
  SaleFilters,
  SaleInput,
  SaleLine
} from '@shared/types'
import { getDb } from '../db'
import { newId, nextNumber, nowIso } from '../db/ids'
import { applyMovement, getProduct } from './products'
import { getSettings } from './settings'

interface SaleRow {
  id: string
  invoice_number: string
  customer_name: string | null
  staff_name: string | null
  sale_date: string
  subtotal: number
  discount_amount: number
  vat_amount: number
  total: number
  payment_method: PaymentMethod
  notes: string | null
  created_at: string
}

interface SaleLineRow {
  id: string
  sale_id: string
  product_id: string | null
  product_name: string
  sku: string
  qty: number
  unit_price: number
  unit_cost: number
  vat_rate: number
  line_total: number
}

function mapLine(r: SaleLineRow): SaleLine {
  return {
    id: r.id,
    saleId: r.sale_id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    qty: r.qty,
    unitPrice: r.unit_price,
    unitCost: r.unit_cost,
    vatRate: r.vat_rate,
    lineTotal: r.line_total
  }
}

function mapSale(r: SaleRow, lines: SaleLine[]): Sale {
  const profit = lines.reduce((acc, l) => acc + (l.unitPrice - l.unitCost) * l.qty, 0) - r.discount_amount
  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    customerName: r.customer_name,
    staffName: r.staff_name,
    saleDate: r.sale_date,
    subtotal: r.subtotal,
    discountAmount: r.discount_amount,
    vatAmount: r.vat_amount,
    total: r.total,
    paymentMethod: r.payment_method,
    notes: r.notes,
    lines,
    profit,
    createdAt: r.created_at
  }
}

export function getSale(id: string): Sale | null {
  const db = getDb()
  const row = db.get<SaleRow>('SELECT * FROM sales WHERE id = ?', [id])
  if (!row) return null
  const lines = db.all<SaleLineRow>('SELECT * FROM sale_lines WHERE sale_id = ?', [id]).map(mapLine)
  return mapSale(row, lines)
}

export function listSales(filters: SaleFilters = {}): Sale[] {
  const db = getDb()
  const where: string[] = ['archived = 0']
  const params: unknown[] = []
  if (filters.from) {
    where.push('sale_date >= ?')
    params.push(filters.from)
  }
  if (filters.to) {
    where.push('sale_date <= ?')
    params.push(filters.to + 'T23:59:59')
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    where.push('payment_method = ?')
    params.push(filters.paymentMethod)
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`
    where.push('(invoice_number LIKE ? OR customer_name LIKE ? OR staff_name LIKE ?)')
    params.push(q, q, q)
  }
  const limit = filters.limit ?? 500
  const page = filters.page ?? 1
  const offset = (page - 1) * limit
  params.push(limit, offset)
  const rows = db.all<SaleRow>(
    `SELECT * FROM sales ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY sale_date DESC, created_at DESC LIMIT ? OFFSET ?`,
    params
  )
  return rows.map((r) => {
    const lines = db
      .all<SaleLineRow>('SELECT * FROM sale_lines WHERE sale_id = ?', [r.id])
      .map(mapLine)
    return mapSale(r, lines)
  })
}

/**
 * Records a sale and decrements stock atomically. Each line creates a
 * 'sale' stock movement referencing the invoice number, so the audit trail
 * is complete without any extra work at the till.
 */
export function createSale(input: SaleInput): Sale {
  const db = getDb()
  const settings = getSettings()
  if (!input.lines || input.lines.length === 0) throw new Error('A sale needs at least one item.')

  let saleId = ''
  db.transaction(() => {
    saleId = newId()
    const invoiceNumber = nextNumber(db, 'invoice', settings.invoicePrefix)
    const ts = nowIso()

    let subtotal = 0
    let vatAmount = 0
    const preparedLines: Array<Omit<SaleLineRow, 'sale_id'>> = []

    for (const line of input.lines) {
      const product = getProduct(line.productId)
      if (!product) throw new Error('One of the products in this sale no longer exists.')
      const qty = Math.max(1, Math.trunc(line.qty))
      const unitPrice = line.unitPrice ?? product.retailPrice
      const lineTotal = unitPrice * qty
      subtotal += lineTotal
      // Prices are VAT-inclusive; extract the VAT portion for reporting
      vatAmount += lineTotal - lineTotal / (1 + product.vatRate / 100)
      preparedLines.push({
        id: newId(),
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        qty,
        unit_price: unitPrice,
        unit_cost: product.costPrice,
        vat_rate: product.vatRate,
        line_total: lineTotal
      })
    }

    const discount = Math.max(0, input.discountAmount ?? 0)
    if (discount > subtotal) throw new Error('Discount cannot exceed the sale subtotal.')
    const total = subtotal - discount

    db.run(
      `INSERT INTO sales (id, invoice_number, customer_name, staff_name, sale_date, subtotal, discount_amount, vat_amount, total, payment_method, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        invoiceNumber,
        input.customerName?.trim() || null,
        input.staffName?.trim() || settings.staffName || null,
        ts,
        round2(subtotal),
        round2(discount),
        round2(vatAmount),
        round2(total),
        input.paymentMethod,
        input.notes ?? null,
        ts
      ]
    )

    for (const l of preparedLines) {
      db.run(
        `INSERT INTO sale_lines (id, sale_id, product_id, product_name, sku, qty, unit_price, unit_cost, vat_rate, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId ? l.id : l.id, saleId, l.product_id, l.product_name, l.sku, l.qty, l.unit_price, l.unit_cost, l.vat_rate, round2(l.line_total)]
      )
      applyMovement({
        productId: l.product_id!,
        movementType: 'sale',
        qtyChange: -l.qty,
        reference: invoiceNumber,
        staffName: input.staffName ?? null
      })
    }
  })

  return getSale(saleId)!
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
