import type { Brand, Category, CategoryScope, EquipmentType, Supplier } from '@shared/types'
import { getDb } from '../db'
import { newId, nowIso } from '../db/ids'

// --- Categories -------------------------------------------------------------

interface CategoryRow {
  id: string
  name: string
  scope: CategoryScope
  is_system: number
  created_at: string
}

export function listCategories(scope?: CategoryScope | 'all'): Category[] {
  const db = getDb()
  const rows =
    !scope || scope === 'all'
      ? db.all<CategoryRow>('SELECT * FROM categories WHERE archived = 0 ORDER BY name')
      : db.all<CategoryRow>(
          "SELECT * FROM categories WHERE (scope = ? OR scope = 'both') AND archived = 0 ORDER BY name",
          [scope]
        )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    isSystem: r.is_system === 1,
    createdAt: r.created_at
  }))
}

export function createCategory(name: string, scope: CategoryScope): Category {
  const db = getDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required.')
  const id = newId()
  const ts = nowIso()
  db.run('INSERT INTO categories (id, name, scope, is_system, created_at) VALUES (?, ?, ?, 0, ?)', [
    id,
    trimmed,
    scope,
    ts
  ])
  return { id, name: trimmed, scope, isSystem: false, createdAt: ts }
}

export function updateCategory(id: string, name: string, scope: CategoryScope): void {
  const db = getDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required.')
  db.run('UPDATE categories SET name = ?, scope = ? WHERE id = ?', [trimmed, scope, id])
}

export function deleteCategory(id: string): void {
  const db = getDb()
  const used = db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM rental_assets WHERE category_id = ?) +
            (SELECT COUNT(*) FROM products WHERE category_id = ?) +
            (SELECT COUNT(*) FROM equipment_types WHERE category_id = ?) AS n`,
    [id, id, id]
  )
  if (used && used.n > 0)
    throw new Error('This item cannot be removed because it is linked to historical records.')
  db.run('UPDATE categories SET archived = 1 WHERE id = ?', [id])
}

// --- Equipment types ---------------------------------------------------------

interface TypeRow {
  id: string
  name: string
  category_id: string | null
  category_name: string | null
  created_at: string
}

export function listEquipmentTypes(): EquipmentType[] {
  const db = getDb()
  const rows = db.all<TypeRow>(
    `SELECT t.*, c.name AS category_name
     FROM equipment_types t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.archived = 0
     ORDER BY t.name`
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    createdAt: r.created_at
  }))
}

export function createEquipmentType(name: string, categoryId: string | null): EquipmentType {
  const db = getDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Equipment type name is required.')
  const id = newId()
  const ts = nowIso()
  db.run('INSERT INTO equipment_types (id, name, category_id, created_at) VALUES (?, ?, ?, ?)', [
    id,
    trimmed,
    categoryId,
    ts
  ])
  return { id, name: trimmed, categoryId, createdAt: ts }
}

export function updateEquipmentType(id: string, name: string, categoryId: string | null): void {
  const db = getDb()
  db.run('UPDATE equipment_types SET name = ?, category_id = ? WHERE id = ?', [
    name.trim(),
    categoryId,
    id
  ])
}

export function deleteEquipmentType(id: string): void {
  const db = getDb()
  const used = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM rental_assets WHERE equipment_type_id = ?', [id])
  if (used && used.n > 0)
    throw new Error('This item cannot be removed because it is linked to historical records.')
  db.run('UPDATE equipment_types SET archived = 1 WHERE id = ?', [id])
}

// --- Brands -------------------------------------------------------------------

export function listBrands(): Brand[] {
  const db = getDb()
  return db
    .all<{ id: string; name: string; created_at: string }>('SELECT * FROM brands WHERE archived = 0 ORDER BY name')
    .map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export function createBrand(name: string): Brand {
  const db = getDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Brand name is required.')
  const existing = db.get<{ id: string; name: string; created_at: string }>(
    'SELECT * FROM brands WHERE name = ? COLLATE NOCASE',
    [trimmed]
  )
  if (existing) return { id: existing.id, name: existing.name, createdAt: existing.created_at }
  const id = newId()
  const ts = nowIso()
  db.run('INSERT INTO brands (id, name, created_at) VALUES (?, ?, ?)', [id, trimmed, ts])
  return { id, name: trimmed, createdAt: ts }
}

export function deleteBrand(id: string): void {
  const db = getDb()
  const used = db.get<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM rental_assets WHERE brand_id = ?) +
            (SELECT COUNT(*) FROM products WHERE brand_id = ?) AS n`,
    [id, id]
  )
  if (used && used.n > 0) throw new Error('This item cannot be removed because it is linked to historical records.')
  db.run('UPDATE brands SET archived = 1 WHERE id = ?', [id])
}

// --- Suppliers ------------------------------------------------------------------

interface SupplierRow {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  archived: number
  created_at: string
}

function mapSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    name: r.name,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    website: r.website,
    address: r.address,
    notes: r.notes,
    archived: r.archived === 1,
    createdAt: r.created_at
  }
}

export function listSuppliers(includeArchived = false): Supplier[] {
  const db = getDb()
  const rows = includeArchived
    ? db.all<SupplierRow>('SELECT * FROM suppliers ORDER BY name')
    : db.all<SupplierRow>('SELECT * FROM suppliers WHERE archived = 0 ORDER BY name')
  return rows.map(mapSupplier)
}

export interface SupplierInput {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  notes?: string | null
}

export function createSupplier(input: SupplierInput): Supplier {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('Supplier name is required.')
  const id = newId()
  const ts = nowIso()
  db.run(
    `INSERT INTO suppliers (id, name, contact_name, email, phone, website, address, notes, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, name, input.contactName ?? null, input.email ?? null, input.phone ?? null, input.website ?? null, input.address ?? null, input.notes ?? null, ts]
  )
  return mapSupplier(db.get<SupplierRow>('SELECT * FROM suppliers WHERE id = ?', [id])!)
}

export function updateSupplier(id: string, input: SupplierInput): void {
  const db = getDb()
  db.run(
    `UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, website = ?, address = ?, notes = ?
     WHERE id = ?`,
    [input.name.trim(), input.contactName ?? null, input.email ?? null, input.phone ?? null, input.website ?? null, input.address ?? null, input.notes ?? null, id]
  )
}

export function setSupplierArchived(id: string, archived: boolean): void {
  getDb().run('UPDATE suppliers SET archived = ? WHERE id = ?', [archived ? 1 : 0, id])
}
