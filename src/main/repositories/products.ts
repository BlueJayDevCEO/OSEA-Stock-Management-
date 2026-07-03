import type {
  MovementType,
  Product,
  ProductFilters,
  ProductInput,
  StockAdjustmentInput,
  StockMovement
} from '@shared/types'
import { getDb } from '../db'
import { newId, nextNumber, nowIso } from '../db/ids'
import { getSettings } from './settings'

interface ProductRow {
  id: string
  sku: string
  barcode: string | null
  name: string
  brand_id: string | null
  brand_name: string | null
  category_id: string | null
  category_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  cost_price: number
  retail_price: number
  vat_rate: number
  stock_qty: number
  min_stock: number
  max_stock: number | null
  shelf_location: string | null
  description: string | null
  image: string | null
  archived: number
  created_at: string
  updated_at: string
}

const BASE_SELECT = `
  SELECT p.*,
         b.name AS brand_name,
         c.name AS category_name,
         s.name AS supplier_name
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`

function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
    brandId: r.brand_id,
    brandName: r.brand_name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    costPrice: r.cost_price,
    retailPrice: r.retail_price,
    vatRate: r.vat_rate,
    stockQty: r.stock_qty,
    minStock: r.min_stock,
    maxStock: r.max_stock,
    shelfLocation: r.shelf_location,
    description: r.description,
    image: r.image,
    archived: r.archived === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function listProducts(filters: ProductFilters = {}): Product[] {
  const db = getDb()
  const where: string[] = []
  const params: unknown[] = []

  if (!filters.includeArchived) where.push('p.archived = 0')
  if (filters.categoryId) {
    where.push('p.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters.brandId) {
    where.push('p.brand_id = ?')
    params.push(filters.brandId)
  }
  if (filters.supplierId) {
    where.push('p.supplier_id = ?')
    params.push(filters.supplierId)
  }
  if (filters.stockLevel === 'low') where.push('p.stock_qty > 0 AND p.stock_qty <= p.min_stock')
  if (filters.stockLevel === 'out') where.push('p.stock_qty <= 0')
  if (filters.stockLevel === 'in_stock') where.push('p.stock_qty > 0')
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`
    where.push(
      `(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?
        OR b.name LIKE ? OR c.name LIKE ? OR p.shelf_location LIKE ?)`
    )
    params.push(q, q, q, q, q, q, q)
  }

  const limit = filters.limit ?? 1000
  const page = filters.page ?? 1
  const offset = (page - 1) * limit
  params.push(limit, offset)

  const sql = `${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.name LIMIT ? OFFSET ?`
  return db.all<ProductRow>(sql, params).map(mapProduct)
}

export function getProduct(id: string): Product | null {
  const row = getDb().get<ProductRow>(`${BASE_SELECT} WHERE p.id = ?`, [id])
  return row ? mapProduct(row) : null
}

export function getProductByCode(code: string): Product | null {
  const row = getDb().get<ProductRow>(
    `${BASE_SELECT} WHERE p.sku = ? COLLATE NOCASE OR p.barcode = ?`,
    [code, code]
  )
  return row ? mapProduct(row) : null
}

export function createProduct(input: ProductInput): Product {
  const db = getDb()
  const settings = getSettings()
  if (!input.name || !input.name.trim()) throw new Error('Product name is required.')

  let id = ''
  db.transaction(() => {
    id = newId()
    const ts = nowIso()
    const sku = input.sku?.trim() || nextNumber(db, 'sku', settings.skuPrefix)
    db.run(
      `INSERT INTO products (
         id, sku, barcode, name, brand_id, category_id, supplier_id,
         cost_price, retail_price, vat_rate, stock_qty, min_stock, max_stock,
         shelf_location, description, image, archived, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        sku,
        input.barcode ?? null,
        input.name.trim(),
        input.brandId ?? null,
        input.categoryId ?? null,
        input.supplierId ?? null,
        input.costPrice ?? 0,
        input.retailPrice ?? 0,
        input.vatRate ?? settings.defaultVatRate,
        input.minStock ?? 0,
        input.maxStock ?? null,
        input.shelfLocation ?? null,
        input.description ?? null,
        input.image ?? null,
        ts,
        ts
      ]
    )
    const opening = Math.max(0, Math.floor(input.openingStock ?? 0))
    if (opening > 0) {
      applyMovement({
        productId: id,
        movementType: 'initial',
        qtyChange: opening,
        notes: 'Opening stock'
      })
    }
  })
  return getProduct(id)!
}

export function updateProduct(id: string, input: ProductInput): Product {
  const db = getDb()
  const existing = getProduct(id)
  if (!existing) throw new Error('Product not found.')
  db.run(
    `UPDATE products SET
       barcode = ?, name = ?, brand_id = ?, category_id = ?, supplier_id = ?,
       cost_price = ?, retail_price = ?, vat_rate = ?, min_stock = ?, max_stock = ?,
       shelf_location = ?, description = ?, image = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.barcode ?? null,
      input.name.trim(),
      input.brandId ?? null,
      input.categoryId ?? null,
      input.supplierId ?? null,
      input.costPrice ?? existing.costPrice,
      input.retailPrice ?? existing.retailPrice,
      input.vatRate ?? existing.vatRate,
      input.minStock ?? existing.minStock,
      input.maxStock ?? null,
      input.shelfLocation ?? null,
      input.description ?? null,
      input.image ?? existing.image,
      nowIso(),
      id
    ]
  )
  return getProduct(id)!
}

export function setProductArchived(id: string, archived: boolean): void {
  getDb().run('UPDATE products SET archived = ?, updated_at = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowIso(),
    id
  ])
}

// ---------------------------------------------------------------------------
// Stock movements — stock never changes without a recorded transaction.
// This is the ONLY code path that mutates products.stock_qty.
// ---------------------------------------------------------------------------

export function applyMovement(input: StockAdjustmentInput): StockMovement {
  const db = getDb()
  if (!Number.isFinite(input.qtyChange) || input.qtyChange === 0)
    throw new Error('Quantity change must be a non-zero number.')

  let movementId = ''
  db.transaction(() => {
    const product = db.get<{ stock_qty: number; name: string }>(
      'SELECT stock_qty, name FROM products WHERE id = ?',
      [input.productId]
    )
    if (!product) throw new Error('Product not found.')
    const qtyAfter = product.stock_qty + Math.trunc(input.qtyChange)
    if (qtyAfter < 0)
      throw new Error(
        `Not enough stock of "${product.name}" — ${product.stock_qty} in stock, tried to remove ${Math.abs(input.qtyChange)}.`
      )

    db.run('UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?', [
      qtyAfter,
      nowIso(),
      input.productId
    ])
    movementId = newId()
    db.run(
      `INSERT INTO stock_movements (id, product_id, movement_type, qty_change, qty_after, reference, notes, staff_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        input.productId,
        input.movementType,
        Math.trunc(input.qtyChange),
        qtyAfter,
        input.reference ?? null,
        input.notes ?? null,
        input.staffName ?? null,
        nowIso()
      ]
    )
  })

  return getMovement(movementId)!
}

interface MovementRow {
  id: string
  product_id: string
  product_name: string
  sku: string
  movement_type: MovementType
  qty_change: number
  qty_after: number
  reference: string | null
  notes: string | null
  staff_name: string | null
  created_at: string
}

const MOVEMENT_SELECT = `
  SELECT m.*, p.name AS product_name, p.sku AS sku
  FROM stock_movements m
  JOIN products p ON p.id = m.product_id
`

function mapMovement(r: MovementRow): StockMovement {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    sku: r.sku,
    movementType: r.movement_type,
    qtyChange: r.qty_change,
    qtyAfter: r.qty_after,
    reference: r.reference,
    notes: r.notes,
    staffName: r.staff_name,
    createdAt: r.created_at
  }
}

export function getMovement(id: string): StockMovement | null {
  const row = getDb().get<MovementRow>(`${MOVEMENT_SELECT} WHERE m.id = ?`, [id])
  return row ? mapMovement(row) : null
}

export function listMovements(productId?: string, limit = 300): StockMovement[] {
  const db = getDb()
  const rows = productId
    ? db.all<MovementRow>(
        `${MOVEMENT_SELECT} WHERE m.product_id = ? ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`,
        [productId, limit]
      )
    : db.all<MovementRow>(`${MOVEMENT_SELECT} ORDER BY m.created_at DESC, m.rowid DESC LIMIT ?`, [
        limit
      ])
  return rows.map(mapMovement)
}
