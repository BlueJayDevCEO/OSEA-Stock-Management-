import type { DashboardStats, ReportRequest, ReportResult, SearchResultItem } from '@shared/types'
import { RENTAL_STATUS_LABELS, MOVEMENT_TYPE_LABELS } from '@shared/types'
import { getDb } from '../db'

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function getDashboardStats(): DashboardStats {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + '01'

  const rental = db.get<{ n: number; value: number }>(
    'SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(replacement_value, purchase_price, 0)), 0) AS value FROM rental_assets WHERE archived = 0'
  )!
  const statusRows = db.all<{ status: string; n: number }>(
    'SELECT status, COUNT(*) AS n FROM rental_assets WHERE archived = 0 GROUP BY status'
  )
  const retail = db.get<{ n: number; cost: number; retail: number }>(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(stock_qty * cost_price), 0) AS cost,
            COALESCE(SUM(stock_qty * retail_price), 0) AS retail
     FROM products WHERE archived = 0`
  )!
  const low = db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM products WHERE archived = 0 AND stock_qty > 0 AND stock_qty <= min_stock'
  )!
  const out = db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM products WHERE archived = 0 AND stock_qty <= 0'
  )!
  const salesToday = db.get<{ n: number; total: number }>(
    'SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM sales WHERE sale_date >= ?',
    [today]
  )!
  const salesMonth = db.get<{ total: number }>(
    'SELECT COALESCE(SUM(total), 0) AS total FROM sales WHERE sale_date >= ?',
    [monthStart]
  )!
  const monthProfit = db.get<{ profit: number }>(
    `SELECT (
       SELECT COALESCE(SUM((unit_price - unit_cost) * qty), 0)
       FROM sale_lines WHERE sale_id IN (SELECT id FROM sales WHERE sale_date >= ?)
     ) - (
       SELECT COALESCE(SUM(discount_amount), 0)
       FROM sales WHERE sale_date >= ?
     ) AS profit`,
    [monthStart, monthStart]
  )!
  const monthDiscounts = db.get<{ d: number }>(
    'SELECT COALESCE(SUM(discount_amount), 0) AS d FROM sales WHERE sale_date >= ?',
    [monthStart]
  )!
  const serviceDue = db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM rental_assets
     WHERE archived = 0 AND status NOT IN ('retired','lost')
       AND next_service_date IS NOT NULL AND next_service_date <= date('now', '+14 days')`
  )!
  const overdue = db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM rental_assets
     WHERE archived = 0 AND status = 'checked_out' AND due_back IS NOT NULL AND due_back < ?`,
    [today]
  )!

  const salesSeries = db.all<{ d: string; total: number }>(
    `SELECT substr(sale_date, 1, 10) AS d, SUM(total) AS total
     FROM sales WHERE sale_date >= date('now', '-13 days')
     GROUP BY substr(sale_date, 1, 10)`
  )
  const seriesMap = new Map(salesSeries.map((r) => [r.d, r.total]))
  const salesLast14Days: Array<{ date: string; total: number }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    salesLast14Days.push({ date: d, total: Math.round((seriesMap.get(d) ?? 0) * 100) / 100 })
  }

  // Recent activity — merge latest events across modules
  const recentSales = db.all<{ id: string; title: string; detail: string; created_at: string }>(
    `SELECT id, invoice_number AS title,
            COALESCE(customer_name, 'Walk-in') || ' — ' || printf('%.2f', total) AS detail,
            created_at
     FROM sales ORDER BY created_at DESC LIMIT 6`
  )
  const recentEvents = db.all<{
    id: string
    event_type: string
    asset_number: string
    detail: string | null
    created_at: string
  }>(
    `SELECT e.id, e.event_type, a.asset_number,
            COALESCE(e.customer_name, e.notes, '') AS detail, e.created_at
     FROM rental_events e JOIN rental_assets a ON a.id = e.asset_id
     WHERE e.event_type != 'created'
     ORDER BY e.created_at DESC LIMIT 6`
  )
  const recentMovements = db.all<{
    id: string
    movement_type: string
    name: string
    qty_change: number
    created_at: string
  }>(
    `SELECT m.id, m.movement_type, p.name, m.qty_change, m.created_at
     FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.movement_type NOT IN ('sale', 'initial')
     ORDER BY m.created_at DESC LIMIT 6`
  )

  const activity = [
    ...recentSales.map((s) => ({
      id: s.id,
      kind: 'sale' as const,
      title: `Sale ${s.title}`,
      detail: s.detail,
      createdAt: s.created_at
    })),
    ...recentEvents.map((e) => ({
      id: e.id,
      kind: 'rental_event' as const,
      title: `${e.asset_number} — ${e.event_type.replace(/_/g, ' ')}`,
      detail: e.detail ?? '',
      createdAt: e.created_at
    })),
    ...recentMovements.map((m) => ({
      id: m.id,
      kind: 'movement' as const,
      title: `${m.name}`,
      detail: `${MOVEMENT_TYPE_LABELS[m.movement_type as keyof typeof MOVEMENT_TYPE_LABELS] ?? m.movement_type}: ${m.qty_change > 0 ? '+' : ''}${m.qty_change}`,
      createdAt: m.created_at
    }))
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)

  const statusCounts: Record<string, number> = {}
  for (const r of statusRows) statusCounts[r.status] = r.n

  return {
    rentalAssetCount: rental.n,
    rentalValueTotal: rental.value,
    rentalStatusCounts: statusCounts,
    retailStockValueCost: retail.cost,
    retailStockValueRetail: retail.retail,
    retailProductCount: retail.n,
    lowStockCount: low.n,
    outOfStockCount: out.n,
    salesTodayTotal: salesToday.total,
    salesTodayCount: salesToday.n,
    salesMonthTotal: salesMonth.total,
    salesMonthProfit: monthProfit.profit - monthDiscounts.d,
    serviceDueCount: serviceDue.n,
    overdueRentals: overdue.n,
    recentActivity: activity,
    salesLast14Days
  }
}

// ---------------------------------------------------------------------------
// Global search — QR scan, asset id, SKU, barcode, serial, brand, model…
// ---------------------------------------------------------------------------

export function globalSearch(query: string, limit = 20): SearchResultItem[] {
  const db = getDb()
  const q = query.trim()
  if (!q) return []
  const like = `%${q}%`

  const assets = db.all<{
    id: string
    asset_number: string
    status: string
    model: string | null
    type_name: string | null
    brand_name: string | null
    size: string | null
  }>(
    `SELECT a.id, a.asset_number, a.status, a.model, a.size,
            t.name AS type_name, b.name AS brand_name
     FROM rental_assets a
     LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
     LEFT JOIN brands b ON b.id = a.brand_id
     WHERE a.archived = 0 AND (
       a.asset_number LIKE ? OR a.serial_number LIKE ? OR a.model LIKE ?
       OR t.name LIKE ? OR b.name LIKE ?)
     ORDER BY a.asset_number LIMIT ?`,
    [like, like, like, like, like, limit]
  )

  const products = db.all<{
    id: string
    sku: string
    name: string
    barcode: string | null
    stock_qty: number
    brand_name: string | null
  }>(
    `SELECT p.id, p.sku, p.name, p.barcode, p.stock_qty, b.name AS brand_name
     FROM products p LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.archived = 0 AND (
       p.sku LIKE ? OR p.barcode LIKE ? OR p.name LIKE ? OR b.name LIKE ?)
     ORDER BY p.name LIMIT ?`,
    [like, like, like, like, limit]
  )

  const sales = db.all<{ id: string; invoice_number: string; customer_name: string | null; total: number }>(
    `SELECT id, invoice_number, customer_name, total FROM sales
     WHERE invoice_number LIKE ? OR customer_name LIKE ? ORDER BY sale_date DESC LIMIT 5`,
    [like, like]
  )

  const pos = db.all<{ id: string; po_number: string; status: string; supplier_name: string | null }>(
    `SELECT po.id, po.po_number, po.status, s.name AS supplier_name
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
     WHERE po.po_number LIKE ? LIMIT 5`,
    [like]
  )

  const suppliers = db.all<{ id: string; name: string; email: string | null }>(
    'SELECT id, name, email FROM suppliers WHERE archived = 0 AND name LIKE ? LIMIT 5',
    [like]
  )

  const results: SearchResultItem[] = [
    ...assets.map((a) => ({
      kind: 'asset' as const,
      id: a.id,
      title: [a.brand_name, a.model, a.type_name].filter(Boolean).join(' ') || a.asset_number,
      subtitle: [a.type_name, a.size ? `Size ${a.size}` : null].filter(Boolean).join(' · '),
      code: a.asset_number,
      status: a.status
    })),
    ...products.map((p) => ({
      kind: 'product' as const,
      id: p.id,
      title: p.name,
      subtitle: [p.brand_name, `${p.stock_qty} in stock`].filter(Boolean).join(' · '),
      code: p.sku
    })),
    ...sales.map((s) => ({
      kind: 'sale' as const,
      id: s.id,
      title: `Sale ${s.invoice_number}`,
      subtitle: s.customer_name ?? 'Walk-in customer',
      code: s.invoice_number
    })),
    ...pos.map((p) => ({
      kind: 'po' as const,
      id: p.id,
      title: `PO ${p.po_number}`,
      subtitle: p.supplier_name ?? '',
      code: p.po_number,
      status: p.status
    })),
    ...suppliers.map((s) => ({
      kind: 'supplier' as const,
      id: s.id,
      title: s.name,
      subtitle: s.email ?? '',
      code: ''
    }))
  ]

  // Exact code matches first (QR / barcode scans resolve instantly)
  const lower = q.toLowerCase()
  results.sort((a, b) => {
    const aExact = a.code.toLowerCase() === lower ? 0 : 1
    const bExact = b.code.toLowerCase() === lower ? 0 : 1
    return aExact - bExact
  })
  return results.slice(0, limit)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function runReport(req: ReportRequest): ReportResult {
  const db = getDb()
  const generatedAt = new Date().toISOString()
  const from = req.from ?? '0000-01-01'
  const to = (req.to ?? '9999-12-31') + 'T23:59:59'

  switch (req.report) {
    case 'inventory_value': {
      const rentalRows = db.all<{ label: string; count: number; value: number }>(
        `SELECT COALESCE(t.name, 'Unassigned') AS label, COUNT(*) AS count,
                COALESCE(SUM(COALESCE(a.replacement_value, a.purchase_price, 0)), 0) AS value
         FROM rental_assets a LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
         WHERE a.archived = 0 GROUP BY t.name ORDER BY value DESC`
      )
      const retailRows = db.all<{ label: string; count: number; value: number }>(
        `SELECT COALESCE(c.name, 'Unassigned') AS label, COUNT(*) AS count,
                COALESCE(SUM(p.stock_qty * p.cost_price), 0) AS value
         FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.archived = 0 GROUP BY c.name ORDER BY value DESC`
      )
      const rows = [
        ...rentalRows.map((r) => ({ section: 'Rental fleet', label: r.label, count: r.count, value: r.value })),
        ...retailRows.map((r) => ({ section: 'Retail stock (cost)', label: r.label, count: r.count, value: r.value }))
      ]
      const total = rows.reduce((a, r) => a + r.value, 0)
      return {
        title: 'Inventory Value',
        generatedAt,
        columns: [
          { key: 'section', label: 'Inventory' },
          { key: 'label', label: 'Group' },
          { key: 'count', label: 'Items', align: 'right', format: 'number' },
          { key: 'value', label: 'Value', align: 'right', format: 'money' }
        ],
        rows,
        summary: [{ label: 'Total inventory value', value: String(Math.round(total * 100) / 100) }]
      }
    }

    case 'rental_utilisation': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT COALESCE(t.name, 'Unassigned') AS type,
                COUNT(*) AS fleet,
                SUM(CASE WHEN a.status = 'checked_out' THEN 1 ELSE 0 END) AS out,
                SUM(CASE WHEN a.status = 'available' THEN 1 ELSE 0 END) AS available,
                (SELECT COUNT(*) FROM rental_events e
                  JOIN rental_assets a2 ON a2.id = e.asset_id
                  WHERE a2.equipment_type_id = t.id AND e.event_type = 'checked_out'
                    AND e.created_at BETWEEN ? AND ?) AS checkouts,
                ROUND(100.0 * SUM(CASE WHEN a.status = 'checked_out' THEN 1 ELSE 0 END) / COUNT(*), 1) AS utilisation
         FROM rental_assets a LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
         WHERE a.archived = 0
         GROUP BY t.name, t.id ORDER BY checkouts DESC`,
        [from, to]
      )
      return {
        title: 'Rental Utilisation',
        generatedAt,
        columns: [
          { key: 'type', label: 'Equipment Type' },
          { key: 'fleet', label: 'Fleet Size', align: 'right', format: 'number' },
          { key: 'out', label: 'Out Now', align: 'right', format: 'number' },
          { key: 'available', label: 'Available', align: 'right', format: 'number' },
          { key: 'checkouts', label: 'Check-outs (period)', align: 'right', format: 'number' },
          { key: 'utilisation', label: 'Out Now %', align: 'right', format: 'percent' }
        ],
        rows
      }
    }

    case 'equipment_status': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT a.asset_number, COALESCE(t.name, '') AS type, COALESCE(b.name, '') AS brand,
                COALESCE(a.model, '') AS model, a.status, a.condition,
                COALESCE(a.current_renter, '') AS renter, COALESCE(a.due_back, '') AS due_back
         FROM rental_assets a
         LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
         LEFT JOIN brands b ON b.id = a.brand_id
         WHERE a.archived = 0 ORDER BY a.status, a.asset_number`
      )
      return {
        title: 'Equipment Status',
        generatedAt,
        columns: [
          { key: 'asset_number', label: 'Asset' },
          { key: 'type', label: 'Type' },
          { key: 'brand', label: 'Brand' },
          { key: 'model', label: 'Model' },
          { key: 'status', label: 'Status' },
          { key: 'condition', label: 'Condition' },
          { key: 'renter', label: 'With Customer' },
          { key: 'due_back', label: 'Due Back', format: 'date' }
        ],
        rows: rows.map((r) => ({
          ...r,
          status: RENTAL_STATUS_LABELS[r.status as keyof typeof RENTAL_STATUS_LABELS] ?? r.status
        }))
      }
    }

    case 'service_due': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT a.asset_number, COALESCE(t.name, '') AS type, COALESCE(b.name, '') AS brand,
                COALESCE(a.model, '') AS model, a.status,
                COALESCE(a.last_service_date, '') AS last_service,
                a.next_service_date AS next_service,
                CAST(julianday(a.next_service_date) - julianday('now') AS INTEGER) AS days
         FROM rental_assets a
         LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
         LEFT JOIN brands b ON b.id = a.brand_id
         WHERE a.archived = 0 AND a.status NOT IN ('retired','lost') AND a.next_service_date IS NOT NULL
         ORDER BY a.next_service_date`
      )
      return {
        title: 'Equipment Due For Service',
        generatedAt,
        columns: [
          { key: 'asset_number', label: 'Asset' },
          { key: 'type', label: 'Type' },
          { key: 'brand', label: 'Brand' },
          { key: 'model', label: 'Model' },
          { key: 'last_service', label: 'Last Service', format: 'date' },
          { key: 'next_service', label: 'Next Service', format: 'date' },
          { key: 'days', label: 'Days Until Due', align: 'right', format: 'number' }
        ],
        rows
      }
    }

    case 'sales': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT invoice_number, substr(sale_date, 1, 10) AS date,
                COALESCE(customer_name, 'Walk-in') AS customer,
                COALESCE(staff_name, '') AS staff,
                subtotal, discount_amount, vat_amount, total, payment_method
         FROM sales WHERE sale_date BETWEEN ? AND ? ORDER BY sale_date DESC`,
        [from, to]
      )
      const total = rows.reduce((a, r) => a + Number(r.total ?? 0), 0)
      return {
        title: 'Sales',
        generatedAt,
        columns: [
          { key: 'invoice_number', label: 'Invoice' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer' },
          { key: 'staff', label: 'Staff' },
          { key: 'subtotal', label: 'Subtotal', align: 'right', format: 'money' },
          { key: 'discount_amount', label: 'Discount', align: 'right', format: 'money' },
          { key: 'vat_amount', label: 'VAT', align: 'right', format: 'money' },
          { key: 'total', label: 'Total', align: 'right', format: 'money' },
          { key: 'payment_method', label: 'Payment' }
        ],
        rows,
        summary: [
          { label: 'Sales in period', value: String(rows.length) },
          { label: 'Revenue', value: String(Math.round(total * 100) / 100) }
        ]
      }
    }

    case 'profit': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT l.product_name AS product, l.sku,
                SUM(l.qty) AS units,
                ROUND(SUM(l.line_total), 2) AS revenue,
                ROUND(SUM(l.unit_cost * l.qty), 2) AS cost,
                ROUND(SUM((l.unit_price - l.unit_cost) * l.qty), 2) AS profit,
                ROUND(100.0 * SUM((l.unit_price - l.unit_cost) * l.qty) / MAX(SUM(l.line_total), 0.01), 1) AS margin
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY l.product_name, l.sku ORDER BY profit DESC`,
        [from, to]
      )
      const profit = rows.reduce((a, r) => a + Number(r.profit ?? 0), 0)
      return {
        title: 'Profit by Product',
        generatedAt,
        columns: [
          { key: 'product', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'units', label: 'Units', align: 'right', format: 'number' },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
          { key: 'cost', label: 'Cost', align: 'right', format: 'money' },
          { key: 'profit', label: 'Profit', align: 'right', format: 'money' },
          { key: 'margin', label: 'Margin %', align: 'right', format: 'percent' }
        ],
        rows,
        summary: [{ label: 'Gross profit (before discounts)', value: String(Math.round(profit * 100) / 100) }]
      }
    }

    case 'supplier': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT s.name AS supplier,
                (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.archived = 0) AS products,
                (SELECT COUNT(*) FROM rental_assets a WHERE a.supplier_id = s.id AND a.archived = 0) AS assets,
                (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id) AS orders,
                (SELECT COALESCE(SUM(l.qty_received * l.unit_cost), 0)
                   FROM purchase_order_lines l JOIN purchase_orders po ON po.id = l.po_id
                   WHERE po.supplier_id = s.id) AS received_value
         FROM suppliers s WHERE s.archived = 0 ORDER BY received_value DESC`
      )
      return {
        title: 'Suppliers',
        generatedAt,
        columns: [
          { key: 'supplier', label: 'Supplier' },
          { key: 'products', label: 'Retail Products', align: 'right', format: 'number' },
          { key: 'assets', label: 'Rental Assets', align: 'right', format: 'number' },
          { key: 'orders', label: 'Purchase Orders', align: 'right', format: 'number' },
          { key: 'received_value', label: 'Stock Received Value', align: 'right', format: 'money' }
        ],
        rows
      }
    }

    case 'purchases': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT po.po_number, COALESCE(s.name, '') AS supplier, po.status,
                po.order_date, COALESCE(po.expected_date, '') AS expected,
                (SELECT COALESCE(SUM(qty_ordered * unit_cost), 0) FROM purchase_order_lines WHERE po_id = po.id) AS ordered_value,
                (SELECT COALESCE(SUM(qty_received * unit_cost), 0) FROM purchase_order_lines WHERE po_id = po.id) AS received_value
         FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.created_at BETWEEN ? AND ?
         ORDER BY po.created_at DESC`,
        [from, to]
      )
      return {
        title: 'Purchase Orders',
        generatedAt,
        columns: [
          { key: 'po_number', label: 'PO' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'status', label: 'Status' },
          { key: 'order_date', label: 'Ordered', format: 'date' },
          { key: 'expected', label: 'Expected', format: 'date' },
          { key: 'ordered_value', label: 'Ordered Value', align: 'right', format: 'money' },
          { key: 'received_value', label: 'Received Value', align: 'right', format: 'money' }
        ],
        rows
      }
    }

    case 'damage': {
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT a.asset_number, COALESCE(t.name, '') AS type, COALESCE(b.name, '') AS brand,
                COALESCE(a.model, '') AS model, a.condition,
                substr(e.created_at, 1, 10) AS reported,
                COALESCE(e.notes, '') AS notes
         FROM rental_events e
         JOIN rental_assets a ON a.id = e.asset_id
         LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
         LEFT JOIN brands b ON b.id = a.brand_id
         WHERE e.event_type = 'damage_reported' AND e.created_at BETWEEN ? AND ?
         ORDER BY e.created_at DESC`,
        [from, to]
      )
      return {
        title: 'Damage Reports',
        generatedAt,
        columns: [
          { key: 'asset_number', label: 'Asset' },
          { key: 'type', label: 'Type' },
          { key: 'brand', label: 'Brand' },
          { key: 'model', label: 'Model' },
          { key: 'condition', label: 'Condition' },
          { key: 'reported', label: 'Reported', format: 'date' },
          { key: 'notes', label: 'Notes' }
        ],
        rows
      }
    }

    case 'low_stock':
    case 'out_of_stock': {
      const condition =
        req.report === 'low_stock'
          ? 'p.stock_qty > 0 AND p.stock_qty <= p.min_stock'
          : 'p.stock_qty <= 0'
      const rows = db.all<Record<string, string | number | null>>(
        `SELECT p.sku, p.name, COALESCE(b.name, '') AS brand, COALESCE(c.name, '') AS category,
                p.stock_qty, p.min_stock, COALESCE(s.name, '') AS supplier
         FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.archived = 0 AND ${condition}
         ORDER BY p.stock_qty, p.name`
      )
      return {
        title: req.report === 'low_stock' ? 'Low Stock' : 'Out of Stock',
        generatedAt,
        columns: [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Product' },
          { key: 'brand', label: 'Brand' },
          { key: 'category', label: 'Category' },
          { key: 'stock_qty', label: 'In Stock', align: 'right', format: 'number' },
          { key: 'min_stock', label: 'Minimum', align: 'right', format: 'number' },
          { key: 'supplier', label: 'Supplier' }
        ],
        rows
      }
    }

    default:
      throw new Error(`Unknown report: ${String(req.report)}`)
  }
}
