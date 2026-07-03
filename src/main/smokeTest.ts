/**
 * Headless smoke test: `OSEA Dive Manager --smoke-test [--keep]`
 *
 * Exercises the complete backend through the real repositories against a
 * throwaway database — setup, demo seed, rental workflow, sales, purchase
 * orders, reports, search, backup and export. Used in CI and after
 * dependency upgrades; the UI never needs to open.
 */
import { app } from 'electron'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { closeDatabase, openDatabase } from './db'
import { seedDemoData } from './repositories/demoData'
import * as assets from './repositories/assets'
import * as products from './repositories/products'
import * as sales from './repositories/sales'
import * as pos from './repositories/purchaseOrders'
import * as reports from './repositories/reports'
import * as dataAdmin from './repositories/dataAdmin'

function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`SMOKE FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

export async function runSmokeTest(keep: boolean): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'osea-smoke-'))
  const dbPath = join(dir, 'osea-dive-manager.db')
  console.log(`Smoke test database: ${dbPath}`)

  try {
    openDatabase(dbPath)
    console.log('• Setup & demo data')
    seedDemoData()

    const fleet = assets.listAssets({})
    assert(fleet.length > 40, `demo fleet seeded (${fleet.length} assets)`)
    const shop = products.listProducts({})
    assert(shop.length > 20, `demo shop seeded (${shop.length} products)`)

    console.log('• Rental workflow')
    const available = fleet.find((a) => a.status === 'available')!
    const out = assets.checkOutAsset(available.id, { customerName: 'Smoke Tester', dueBack: '2099-01-01' })
    assert(out.status === 'checked_out' && out.currentRenter === 'Smoke Tester', 'check out')
    let failed = false
    try {
      assets.checkOutAsset(available.id, { customerName: 'Double Booking' })
    } catch {
      failed = true
    }
    assert(failed, 'double check-out is rejected')
    assets.returnAsset(available.id, {})
    assets.setAssetStatus(available.id, 'inspection', {})
    assets.setAssetStatus(available.id, 'cleaning', {})
    const back = assets.setAssetStatus(available.id, 'available', {})
    assert(back.status === 'available', 'return → inspect → clean → available')
    const events = assets.listAssetEvents(available.id)
    assert(events.length >= 5, `workflow fully logged (${events.length} events)`)

    console.log('• Sales & stock integrity')
    const product = products.listProducts({ stockLevel: 'in_stock' })[0]
    const before = product.stockQty
    const sale = sales.createSale({
      paymentMethod: 'card',
      lines: [{ productId: product.id, qty: 1 }]
    })
    assert(sale.invoiceNumber.length > 0, `sale recorded (${sale.invoiceNumber})`)
    const after = products.getProduct(product.id)!
    assert(after.stockQty === before - 1, 'stock decremented by sale')
    const movements = products.listMovements(product.id)
    assert(
      movements[0].movementType === 'sale' && movements[0].reference === sale.invoiceNumber,
      'sale movement recorded with invoice reference'
    )
    let oversell = false
    try {
      sales.createSale({
        paymentMethod: 'cash',
        lines: [{ productId: product.id, qty: after.stockQty + 999 }]
      })
    } catch {
      oversell = true
    }
    assert(oversell, 'overselling is rejected')

    console.log('• Purchase orders')
    const po = pos.createPurchaseOrder({
      supplierId: null,
      lines: [{ productId: product.id, qtyOrdered: 5, unitCost: 2 }]
    })
    pos.updatePoStatus(po.id, 'sent')
    const received = pos.receivePurchaseOrder(po.id, [{ lineId: po.lines[0].id, qtyReceived: 3 }])
    assert(received.status === 'partial', 'partial delivery tracked')
    const done = pos.receivePurchaseOrder(po.id, [{ lineId: po.lines[0].id, qtyReceived: 2 }])
    assert(done.status === 'completed', 'completed when fully received')
    const restocked = products.getProduct(product.id)!
    assert(restocked.stockQty === after.stockQty + 5, 'receiving updates stock')

    console.log('• Reports, dashboard & search')
    const stats = reports.getDashboardStats()
    assert(stats.rentalAssetCount === fleet.length, 'dashboard fleet count')
    assert(stats.salesLast14Days.length === 14, 'sales series')
    for (const r of [
      'inventory_value',
      'rental_utilisation',
      'equipment_status',
      'service_due',
      'sales',
      'profit',
      'supplier',
      'purchases',
      'damage',
      'low_stock',
      'out_of_stock'
    ] as const) {
      const result = reports.runReport({ report: r, from: '2000-01-01', to: '2099-01-01' })
      assert(Array.isArray(result.rows), `report runs: ${r} (${result.rows.length} rows)`)
    }
    const hits = reports.globalSearch(available.assetNumber)
    assert(hits[0]?.code === available.assetNumber, 'exact-code search resolves instantly (QR scan path)')

    console.log('• Backup & export')
    const backupPath = join(dir, 'backup.db')
    await dataAdmin.backupDatabase(backupPath)
    assert(existsSync(backupPath), 'backup file written')
    const exportPath = join(dir, 'export.json')
    const summary = dataAdmin.exportJson(exportPath)
    assert(summary.tables.some((t) => t.name === 'rental_assets' && t.rows > 0), 'JSON export contains data')

    console.log('\nSMOKE TEST PASSED ✔')
  } finally {
    closeDatabase()
    if (!keep) rmSync(dir, { recursive: true, force: true })
  }
  app.exit(0)
}
