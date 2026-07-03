import type { BusinessSettings } from '@shared/types'
import { getDb } from '../db'

const DEFAULTS: BusinessSettings = {
  businessName: 'My Dive Centre',
  currency: 'EUR',
  currencySymbol: '€',
  defaultVatRate: 20,
  assetPrefix: 'AST',
  skuPrefix: 'SKU',
  invoicePrefix: 'INV',
  poPrefix: 'PO',
  staffName: ''
}

export function getSettings(): BusinessSettings {
  const db = getDb()
  const row = db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'business'")
  if (!row) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<BusinessSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function updateSettings(patch: Partial<BusinessSettings>): BusinessSettings {
  const db = getDb()
  const next = { ...getSettings(), ...patch }
  db.run(
    "INSERT INTO settings (key, value) VALUES ('business', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [JSON.stringify(next)]
  )
  return next
}
