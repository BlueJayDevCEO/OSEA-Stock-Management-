import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { SqliteDriver, type SqlDriver } from './driver'
import { migrate } from './schema'
import { newId, nowIso } from './ids'

let driver: SqlDriver | null = null

export function openDatabase(dbPath: string): SqlDriver {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  driver = new SqliteDriver(dbPath)
  migrate(driver)
  ensureDefaults(driver)
  return driver
}

export interface ExistingDatabasePreview {
  businessName: string | null
  counts: Record<string, number> | null
}

const PREVIEW_TABLES = ['rental_assets', 'products', 'sales', 'purchase_orders', 'suppliers']

/**
 * Read-only peek at a candidate database file, used by the Setup Wizard to
 * detect and describe an existing database *before* opening it for real —
 * so setup can warn the customer instead of silently reusing (and
 * overwriting the settings of) someone else's data. Never creates a file:
 * returns null if nothing exists at `dbPath` yet.
 */
export function previewDatabaseAt(dbPath: string): ExistingDatabasePreview | null {
  if (!existsSync(dbPath)) return null
  let probe: Database.Database | null = null
  try {
    probe = new Database(dbPath, { readonly: true, fileMustExist: true })
    let businessName: string | null = null
    try {
      const row = probe.prepare("SELECT value FROM settings WHERE key = 'business'").get() as
        | { value: string }
        | undefined
      businessName = row ? ((JSON.parse(row.value).businessName as string | undefined) ?? null) : null
    } catch {
      businessName = null
    }
    const counts: Record<string, number> = {}
    for (const table of PREVIEW_TABLES) {
      try {
        const row = probe.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number } | undefined
        counts[table] = row?.n ?? 0
      } catch {
        counts[table] = 0
      }
    }
    return { businessName, counts }
  } catch {
    // File exists but isn't a readable OSEA database (corrupt, wrong format,
    // locked). Still report it as "found" — just without a readable preview.
    return { businessName: null, counts: null }
  } finally {
    probe?.close()
  }
}

export function getDb(): SqlDriver {
  if (!driver) throw new Error('Database not initialised — complete first-run setup.')
  return driver
}

export function isDbOpen(): boolean {
  return driver !== null
}

export function closeDatabase(): void {
  if (driver) {
    driver.close()
    driver = null
  }
}

// ---------------------------------------------------------------------------
// Seed data every dive centre starts with. All rows are editable/extendable
// by the owner from Settings — no code changes needed for new categories,
// equipment types, brands or suppliers.
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: Array<{ name: string; scope: 'rental' | 'retail' | 'both' }> = [
  { name: 'BCDs & Wings', scope: 'both' },
  { name: 'Regulators', scope: 'both' },
  { name: 'Cylinders', scope: 'rental' },
  { name: 'Exposure Protection', scope: 'both' },
  { name: 'Masks & Snorkels', scope: 'both' },
  { name: 'Fins', scope: 'both' },
  { name: 'Computers & Instruments', scope: 'both' },
  { name: 'Weights', scope: 'rental' },
  { name: 'Torches & Cameras', scope: 'both' },
  { name: 'Safety & Signalling', scope: 'both' },
  { name: 'Spares & Consumables', scope: 'retail' },
  { name: 'Apparel & Merchandise', scope: 'retail' },
  { name: 'Training Materials', scope: 'retail' },
  { name: 'Accessories', scope: 'both' }
]

const DEFAULT_EQUIPMENT_TYPES: Array<{ name: string; category: string }> = [
  { name: 'BCD', category: 'BCDs & Wings' },
  { name: 'Wing', category: 'BCDs & Wings' },
  { name: 'Backplate', category: 'BCDs & Wings' },
  { name: 'Harness', category: 'BCDs & Wings' },
  { name: 'Regulator', category: 'Regulators' },
  { name: 'Octopus', category: 'Regulators' },
  { name: 'SPG', category: 'Regulators' },
  { name: 'Console', category: 'Regulators' },
  { name: 'Dive Computer', category: 'Computers & Instruments' },
  { name: 'Compass', category: 'Computers & Instruments' },
  { name: 'Cylinder', category: 'Cylinders' },
  { name: 'Stage Bottle', category: 'Cylinders' },
  { name: 'Pony Bottle', category: 'Cylinders' },
  { name: 'Wetsuit', category: 'Exposure Protection' },
  { name: 'Drysuit', category: 'Exposure Protection' },
  { name: 'Hood', category: 'Exposure Protection' },
  { name: 'Gloves', category: 'Exposure Protection' },
  { name: 'Boots', category: 'Exposure Protection' },
  { name: 'Mask', category: 'Masks & Snorkels' },
  { name: 'Snorkel', category: 'Masks & Snorkels' },
  { name: 'Fins', category: 'Fins' },
  { name: 'Weights', category: 'Weights' },
  { name: 'Weight Belt', category: 'Weights' },
  { name: 'DSMB', category: 'Safety & Signalling' },
  { name: 'Reel', category: 'Safety & Signalling' },
  { name: 'Spool', category: 'Safety & Signalling' },
  { name: 'Torch', category: 'Torches & Cameras' },
  { name: 'Camera', category: 'Torches & Cameras' },
  { name: 'Camera Housing', category: 'Torches & Cameras' },
  { name: 'Accessory', category: 'Accessories' }
]

function ensureDefaults(db: SqlDriver): void {
  const catCount = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')
  if (catCount && catCount.n === 0) {
    db.transaction(() => {
      const ts = nowIso()
      const catIds = new Map<string, string>()
      for (const c of DEFAULT_CATEGORIES) {
        const id = newId()
        catIds.set(c.name, id)
        db.run(
          'INSERT INTO categories (id, name, scope, is_system, created_at) VALUES (?, ?, ?, 1, ?)',
          [id, c.name, c.scope, ts]
        )
      }
      for (const t of DEFAULT_EQUIPMENT_TYPES) {
        db.run(
          'INSERT INTO equipment_types (id, name, category_id, created_at) VALUES (?, ?, ?, ?)',
          [newId(), t.name, catIds.get(t.category) ?? null, ts]
        )
      }
    })
  }

  const settingsRow = db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'business'")
  if (!settingsRow) {
    const defaults = {
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
    db.run("INSERT INTO settings (key, value) VALUES ('business', ?)", [JSON.stringify(defaults)])
  }
}
