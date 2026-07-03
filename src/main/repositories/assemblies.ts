import type { Result } from '@shared/types'
import { getDb } from '../db'
import { newId, nowIso } from '../db/ids'

export interface Assembly {
  id: string
  assetNumber: string
  name: string
  status: string
  condition: string
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export function createAssembly(assetNumber: string, name: string, componentAssetIds: string[]): Assembly {
  const db = getDb()
  const id = newId()
  db.transaction(() => {
    db.run(
      `INSERT INTO assemblies (id, asset_number, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, assetNumber, name, nowIso(), nowIso()]
    )
    for (const assetId of componentAssetIds) {
      db.run(`INSERT INTO assembly_components (assembly_id, asset_id) VALUES (?, ?)`, [id, assetId])
    }
  })
  return getAssembly(id)!
}

export function getAssembly(id: string): Assembly | null {
  const row = getDb().get<any>(`SELECT * FROM assemblies WHERE id = ?`, [id])
  if (!row) return null
  return {
    id: row.id,
    assetNumber: row.asset_number,
    name: row.name,
    status: row.status,
    condition: row.condition,
    notes: row.notes,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
