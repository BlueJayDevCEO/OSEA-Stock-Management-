import { getDb } from '../db'
import { newId, nowIso } from '../db/ids'

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  certificationLevel: string | null
  bcdSize: string | null
  suitSize: string | null
  waiverStatus: string
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export function createCustomer(input: Omit<Customer, 'id' | 'archived' | 'createdAt' | 'updatedAt'>): Customer {
  const db = getDb()
  const id = newId()
  db.run(
    `INSERT INTO customers (id, name, phone, email, certification_level, bcd_size, suit_size, waiver_status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.phone || null,
      input.email || null,
      input.certificationLevel || null,
      input.bcdSize || null,
      input.suitSize || null,
      input.waiverStatus || 'none',
      input.notes || null,
      nowIso(),
      nowIso()
    ]
  )
  return getCustomer(id)!
}

export function getCustomer(id: string): Customer | null {
  const row = getDb().get<any>('SELECT * FROM customers WHERE id = ?', [id])
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    certificationLevel: row.certification_level,
    bcdSize: row.bcd_size,
    suitSize: row.suit_size,
    waiverStatus: row.waiver_status,
    notes: row.notes,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listCustomers(page = 1, limit = 1000): Customer[] {
  const db = getDb()
  const offset = (page - 1) * limit
  const rows = db.all<any>(
    'SELECT * FROM customers WHERE archived = 0 ORDER BY name ASC LIMIT ? OFFSET ?',
    [limit, offset]
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    certificationLevel: row.certification_level,
    bcdSize: row.bcd_size,
    suitSize: row.suit_size,
    waiverStatus: row.waiver_status,
    notes: row.notes,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}
