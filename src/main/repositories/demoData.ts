/**
 * Demo dataset — a believable small dive resort: rental fleet, retail shop,
 * suppliers, sales history and purchase orders. Loaded only when the user
 * opts in during first-run setup.
 */
import type { PaymentMethod } from '@shared/types'
import { getDb } from '../db'
import { listCategories, listEquipmentTypes, createBrand, createSupplier } from './catalog'
import { createAsset, checkOutAsset, returnAsset, setAssetStatus, listAssets } from './assets'
import { createProduct } from './products'
import { createSale } from './sales'
import { createPurchaseOrder, updatePoStatus, receivePurchaseOrder } from './purchaseOrders'
import { updateSettings } from './settings'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

function dateInDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

export function seedDemoData(): void {
  const db = getDb()
  const existing = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM rental_assets')
  if (existing && existing.n > 0) return // never seed over real data

  const categories = new Map(listCategories('all').map((c) => [c.name, c.id]))
  const types = new Map(listEquipmentTypes().map((t) => [t.name, t.id]))

  const brands = new Map(
    [
      'Scubapro',
      'Apeks',
      'Aqualung',
      'Mares',
      'Cressi',
      'Suunto',
      'Shearwater',
      'Fourth Element',
      'Halcyon',
      'BigBlue',
      'Best Divers',
      'OSEA'
    ].map((name) => [name, createBrand(name).id])
  )

  const supplierA = createSupplier({
    name: 'Deep Blue Distribution',
    contactName: 'Marta Klein',
    email: 'orders@deepbluedist.example',
    phone: '+34 971 555 210',
    address: 'Polígono Son Bugadelles 14, Santa Ponsa, Mallorca',
    notes: 'Primary distributor — Scubapro, Apeks, Fourth Element. 30-day terms.'
  })
  const supplierB = createSupplier({
    name: 'Mares Iberia',
    contactName: 'Jordi Puig',
    email: 'b2b@maresiberia.example',
    phone: '+34 933 555 908',
    address: 'Carrer de la Marina 202, Barcelona'
  })
  const supplierC = createSupplier({
    name: 'Reef Supplies Co.',
    contactName: 'Ellie Watts',
    email: 'sales@reefsupplies.example',
    phone: '+44 20 5555 0143',
    notes: 'Consumables, spares and merchandise. Fast shipping.'
  })

  // --- Rental fleet ---------------------------------------------------------

  const mkAssets = (
    typeName: string,
    categoryName: string,
    brand: string,
    model: string,
    sizes: string[],
    qtyPerSize: number,
    price: number,
    replacement: number,
    supplierId: string,
    serviceIntervalDays: number | null
  ): void => {
    for (const size of sizes) {
      for (let i = 0; i < qtyPerSize; i++) {
        const boughtDaysAgo = 120 + Math.floor(Math.random() * 600)
        createAsset({
          equipmentTypeId: types.get(typeName) ?? null,
          categoryId: categories.get(categoryName) ?? null,
          brandId: brands.get(brand) ?? null,
          supplierId,
          model,
          size: size || null,
          serialNumber: `${brand.slice(0, 2).toUpperCase()}${Math.floor(100000 + Math.random() * 899999)}`,
          purchaseDate: daysAgoIso(boughtDaysAgo).slice(0, 10),
          purchasePrice: price,
          replacementValue: replacement,
          condition: pick(['excellent', 'good', 'good', 'good', 'fair']),
          serviceIntervalDays,
          lastServiceDate: serviceIntervalDays
            ? daysAgoIso(Math.floor(Math.random() * serviceIntervalDays)).slice(0, 10)
            : null,
          nextServiceDate: serviceIntervalDays
            ? dateInDays(Math.floor(Math.random() * serviceIntervalDays) - 20)
            : null
        })
      }
    }
  }

  mkAssets('BCD', 'BCDs & Wings', 'Scubapro', 'Hydros Pro', ['XS', 'S', 'M', 'L', 'XL'], 2, 520, 620, supplierA.id, 365)
  mkAssets('Regulator', 'Regulators', 'Apeks', 'XTX50 + DS4', [''], 10, 430, 520, supplierA.id, 365)
  mkAssets('Cylinder', 'Cylinders', 'OSEA', 'Steel 12L 232 bar', [''], 12, 210, 260, supplierB.id, 365)
  mkAssets('Cylinder', 'Cylinders', 'OSEA', 'Steel 15L 232 bar', [''], 4, 260, 320, supplierB.id, 365)
  mkAssets('Wetsuit', 'Exposure Protection', 'Fourth Element', 'Proteus II 5mm', ['XS', 'S', 'M', 'L', 'XL'], 2, 240, 290, supplierA.id, null)
  mkAssets('Dive Computer', 'Computers & Instruments', 'Suunto', 'Zoop Novo', [''], 6, 180, 230, supplierB.id, 730)
  mkAssets('Fins', 'Fins', 'Mares', 'Avanti Quattro+', ['S/M', 'M/L', 'XL'], 2, 60, 85, supplierB.id, null)
  mkAssets('Mask', 'Masks & Snorkels', 'Cressi', 'Big Eyes Evolution', [''], 8, 40, 55, supplierB.id, null)
  mkAssets('Torch', 'Torches & Cameras', 'BigBlue', 'AL1200NP', [''], 4, 90, 120, supplierC.id, null)
  mkAssets('DSMB', 'Safety & Signalling', 'Halcyon', 'Diver Alert Marker 1m', [''], 6, 55, 70, supplierC.id, null)
  mkAssets('Weight Belt', 'Weights', 'Best Divers', 'Rubber Belt + 6kg', [''], 8, 35, 45, supplierC.id, null)

  // --- Retail products --------------------------------------------------------

  const mkProduct = (
    name: string,
    categoryName: string,
    brand: string | null,
    cost: number,
    retail: number,
    stock: number,
    minStock: number,
    supplierId: string,
    shelf: string,
    barcode?: string
  ) =>
    createProduct({
      name,
      categoryId: categories.get(categoryName) ?? null,
      brandId: brand ? (brands.get(brand) ?? null) : null,
      supplierId,
      costPrice: cost,
      retailPrice: retail,
      vatRate: 21,
      openingStock: stock,
      minStock,
      shelfLocation: shelf,
      barcode: barcode ?? String(8400000000000 + Math.floor(Math.random() * 99999999))
    })

  const products = [
    mkProduct('Big Eyes Evolution Mask', 'Masks & Snorkels', 'Cressi', 38, 79, 14, 5, supplierB.id, 'A1'),
    mkProduct('Corsica Snorkel', 'Masks & Snorkels', 'Cressi', 12, 29, 22, 8, supplierB.id, 'A1'),
    mkProduct('Avanti Quattro+ Fins', 'Fins', 'Mares', 58, 119, 9, 4, supplierB.id, 'A2'),
    mkProduct('Hydros Pro BCD', 'BCDs & Wings', 'Scubapro', 480, 899, 3, 1, supplierA.id, 'B1'),
    mkProduct('XTX50 Regulator', 'Regulators', 'Apeks', 390, 699, 2, 1, supplierA.id, 'B2'),
    mkProduct('Zoop Novo Dive Computer', 'Computers & Instruments', 'Suunto', 165, 299, 5, 2, supplierB.id, 'B3'),
    mkProduct('Peregrine Dive Computer', 'Computers & Instruments', 'Shearwater', 310, 495, 3, 1, supplierA.id, 'B3'),
    mkProduct('CR2450 Computer Battery', 'Spares & Consumables', null, 1.2, 6, 40, 15, supplierC.id, 'C1'),
    mkProduct('O-Ring Kit (Viton, 50pc)', 'Spares & Consumables', null, 4.5, 15, 18, 6, supplierC.id, 'C1'),
    mkProduct('Silicone Grease 20g', 'Spares & Consumables', null, 2.8, 9, 25, 10, supplierC.id, 'C1'),
    mkProduct('Regulator Mouthpiece', 'Spares & Consumables', 'Best Divers', 2.1, 8, 30, 10, supplierC.id, 'C2'),
    mkProduct('Mask Defog 30ml', 'Spares & Consumables', 'Best Divers', 2.4, 7.5, 28, 12, supplierC.id, 'C2'),
    mkProduct('Fin Strap (Universal)', 'Spares & Consumables', null, 3.2, 12, 12, 6, supplierC.id, 'C2'),
    mkProduct('OSEA Dive Centre T-Shirt', 'Apparel & Merchandise', 'OSEA', 6.5, 24, 35, 10, supplierC.id, 'D1'),
    mkProduct('OSEA Hoodie', 'Apparel & Merchandise', 'OSEA', 16, 49, 18, 6, supplierC.id, 'D1'),
    mkProduct('OSEA Buff / Neck Gaiter', 'Apparel & Merchandise', 'OSEA', 3, 14, 26, 8, supplierC.id, 'D2'),
    mkProduct('Logbook — 100 Dives', 'Training Materials', 'OSEA', 4, 15, 20, 8, supplierC.id, 'D3'),
    mkProduct('Open Water Manual', 'Training Materials', null, 22, 45, 8, 4, supplierC.id, 'D3'),
    mkProduct('DSMB + Spool Set', 'Safety & Signalling', 'Halcyon', 42, 89, 7, 3, supplierA.id, 'A3'),
    mkProduct('Tec Line Arrow Markers (3pk)', 'Accessories', 'Halcyon', 7, 19, 15, 5, supplierA.id, 'A3'),
    mkProduct('AL1200NP Dive Torch', 'Torches & Cameras', 'BigBlue', 85, 169, 4, 2, supplierC.id, 'B4'),
    mkProduct('GoPro Red Filter', 'Torches & Cameras', null, 9, 29, 6, 3, supplierC.id, 'B4'),
    mkProduct('Proteus II Wetsuit 5mm', 'Exposure Protection', 'Fourth Element', 210, 389, 4, 2, supplierA.id, 'E1'),
    mkProduct('Neoprene Boots 5mm', 'Exposure Protection', 'Cressi', 24, 55, 11, 4, supplierB.id, 'E2'),
    mkProduct('Neoprene Gloves 3mm', 'Exposure Protection', 'Cressi', 14, 35, 3, 5, supplierB.id, 'E2'),
    mkProduct('Hood 5mm', 'Exposure Protection', 'Fourth Element', 19, 45, 0, 3, supplierA.id, 'E2')
  ]

  // --- Sales history (last 45 days) -------------------------------------------

  const staff = ['Sofia', 'Marc', 'Nina']
  const customers = [null, null, 'Jonas Weber', 'Amelia Hart', 'Tomás Rivera', 'Yuki Tanaka', null, 'Lena Fischer', null]
  const methods: PaymentMethod[] = ['card', 'card', 'card', 'cash', 'cash', 'bank_transfer']

  const saleCount = 55
  for (let i = 0; i < saleCount; i++) {
    const daysAgo = Math.floor(Math.random() * 45)
    const lineCount = 1 + Math.floor(Math.random() * 3)
    const lines: Array<{ productId: string; qty: number }> = []
    const used = new Set<number>()
    for (let l = 0; l < lineCount; l++) {
      const idx = Math.floor(Math.random() * products.length)
      if (used.has(idx)) continue
      used.add(idx)
      const p = products[idx]
      // don't oversell demo stock
      if (p.stockQty <= 1) continue
      lines.push({ productId: p.id, qty: 1 + Math.floor(Math.random() * 2) })
    }
    if (lines.length === 0) continue
    try {
      const sale = createSale({
        customerName: pick(customers),
        staffName: pick(staff),
        paymentMethod: pick(methods),
        lines
      })
      // Backdate the sale and its movements so the dashboard has history
      const ts = daysAgoIso(daysAgo)
      db.run('UPDATE sales SET sale_date = ?, created_at = ? WHERE id = ?', [ts, ts, sale.id])
      db.run("UPDATE stock_movements SET created_at = ? WHERE reference = ? AND movement_type = 'sale'", [
        ts,
        sale.invoiceNumber
      ])
    } catch {
      // skip sales that would oversell — demo data stays consistent
    }
  }

  // --- Rental activity ----------------------------------------------------------

  const assets = listAssets()
  const renters = ['Jonas Weber', 'Amelia Hart', 'Tomás Rivera', 'Yuki Tanaka', 'Lena Fischer', 'Diego Costa', 'Mia Sørensen']

  // past rentals with full workflow
  for (let i = 0; i < 25; i++) {
    const asset = pick(assets)
    if (asset.status !== 'available') continue
    try {
      checkOutAsset(asset.id, {
        customerName: pick(renters),
        staffName: pick(staff),
        dueBack: dateInDays(1)
      })
      returnAsset(asset.id, { staffName: pick(staff) })
      setAssetStatus(asset.id, 'inspection', { staffName: pick(staff) })
      setAssetStatus(asset.id, 'cleaning', { staffName: pick(staff) })
      setAssetStatus(asset.id, 'available', { notes: 'Cleaned and returned to rack' })
    } catch {
      /* keep demo seeding resilient */
    }
  }

  // current state: some gear out, some in the workflow
  let out = 0
  for (const asset of listAssets()) {
    if (out >= 7) break
    if (asset.status !== 'available') continue
    try {
      checkOutAsset(asset.id, {
        customerName: pick(renters),
        staffName: pick(staff),
        dueBack: dateInDays(out % 3 === 0 ? -1 : 2) // one overdue
      })
      out++
    } catch {
      /* ignore */
    }
  }
  const available = listAssets().filter((a) => a.status === 'available')
  if (available[0]) setAssetStatus(available[0].id, 'cleaning', { notes: 'Post-rental rinse' })
  if (available[1]) setAssetStatus(available[1].id, 'inspection', { notes: 'Annual visual inspection' })
  if (available[2])
    setAssetStatus(available[2].id, 'servicing', { notes: 'First stage service — awaiting parts' })
  if (available[3])
    setAssetStatus(available[3].id, 'damaged', {
      condition: 'poor',
      notes: 'Inflator sticking — reported by customer'
    })

  // --- Purchase orders ------------------------------------------------------------

  const battery = products[7]
  const orings = products[8]
  const defog = products[11]
  const gloves = products[24]
  const hood = products[25]

  const poReceived = createPurchaseOrder({
    supplierId: supplierC.id,
    expectedDate: dateInDays(-3),
    notes: 'Consumables restock',
    lines: [
      { productId: battery.id, qtyOrdered: 20, unitCost: 1.1 },
      { productId: orings.id, qtyOrdered: 10, unitCost: 4.3 },
      { productId: defog.id, qtyOrdered: 12, unitCost: 2.3 }
    ]
  })
  updatePoStatus(poReceived.id, 'sent')
  receivePurchaseOrder(poReceived.id, [
    { lineId: poReceived.lines[0].id, qtyReceived: 20 },
    { lineId: poReceived.lines[1].id, qtyReceived: 10 },
    { lineId: poReceived.lines[2].id, qtyReceived: 12 }
  ])

  const poPartial = createPurchaseOrder({
    supplierId: supplierB.id,
    expectedDate: dateInDays(4),
    notes: 'Exposure protection restock before high season',
    lines: [
      { productId: gloves.id, qtyOrdered: 10, unitCost: 13.5 },
      { productId: hood.id, qtyOrdered: 8, unitCost: 18.0 }
    ]
  })
  updatePoStatus(poPartial.id, 'sent')
  receivePurchaseOrder(poPartial.id, [{ lineId: poPartial.lines[0].id, qtyReceived: 4 }])

  createPurchaseOrder({
    supplierId: supplierA.id,
    expectedDate: dateInDays(14),
    notes: 'Draft — new season rental BCDs',
    lines: [{ productId: products[3].id, qtyOrdered: 2, unitCost: 470 }]
  })

  updateSettings({ businessName: 'Blue Horizon Dive Resort', staffName: 'Sofia' })
}
