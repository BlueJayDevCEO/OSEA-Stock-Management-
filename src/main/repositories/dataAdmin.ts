import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import type { BackupResult, ImportSummary } from '@shared/types'
import { closeDatabase, getDb, openDatabase } from '../db'

/**
 * Data ownership tooling: the customer's data is a single SQLite file they
 * can back up, restore, export and import at will. OSEA hosts nothing.
 */

const EXPORT_TABLES = [
  'settings',
  'counters',
  'categories',
  'equipment_types',
  'brands',
  'suppliers',
  'rental_assets',
  'rental_events',
  'products',
  'stock_movements',
  'purchase_orders',
  'purchase_order_lines',
  'sales',
  'sale_lines',
  'custom_fields',
  'custom_field_values'
] as const

export async function backupDatabase(destPath: string): Promise<BackupResult> {
  const db = getDb()
  await db.backupTo(destPath)
  return { path: destPath, sizeBytes: statSync(destPath).size }
}

export function restoreDatabase(srcPath: string): void {
  if (!existsSync(srcPath)) throw new Error('Backup file not found.')
  const db = getDb()
  const dbPath = db.path
  // sanity check: is this actually a SQLite database?
  const header = readFileSync(srcPath).subarray(0, 16).toString('utf8')
  if (!header.startsWith('SQLite format 3')) {
    throw new Error('That file is not a valid OSEA Dive Manager backup (SQLite database).')
  }
  closeDatabase()
  copyFileSync(srcPath, dbPath)
  openDatabase(dbPath)
}

export function exportJson(destPath: string): ImportSummary {
  const db = getDb()
  const payload: Record<string, unknown> = {
    _meta: {
      application: 'OSEA Dive Manager',
      format: 'osea-dive-manager-export',
      version: 1,
      exportedAt: new Date().toISOString()
    }
  }
  const tables: Array<{ name: string; rows: number }> = []
  for (const table of EXPORT_TABLES) {
    const rows = db.all(`SELECT * FROM ${table}`)
    payload[table] = rows
    tables.push({ name: table, rows: rows.length })
  }
  writeFileSync(destPath, JSON.stringify(payload, null, 2), 'utf8')
  return { tables }
}

export async function exportDemoDatabase(destDir: string): Promise<{ path: string }> {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  
  const db = getDb()
  const sqlitePath = join(destDir, 'OSEA_Demo_Dive_Centre.sqlite')
  const jsonPath = join(destDir, 'OSEA_Demo_Export.json')
  const readmePath = join(destDir, 'README.txt')
  
  // Backup DB
  await db.backupTo(sqlitePath)
  
  // Export JSON
  exportJson(jsonPath)
  
  // Export CSVs
  const tables = [...EXPORT_TABLES, 'cylinders', 'customers', 'assemblies', 'assembly_components']
  for (const table of tables) {
    try {
      const rows = db.all(`SELECT * FROM ${table}`)
      if (rows.length === 0) continue
      const keys = Object.keys(rows[0])
      const csv = [
        keys.join(','),
        ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))
      ].join('\n')
      writeFileSync(join(destDir, `${table}.csv`), csv, 'utf8')
    } catch {} // ignore if table missing
  }

  // Write README
  const readme = `OSEA Dive Manager - Demo Database Export
----------------------------------------
Generated: ${new Date().toISOString()}
Database: OSEA_Demo_Dive_Centre.sqlite

This directory contains a complete snapshot of the generated demo dive centre data,
including the raw SQLite database, a JSON manifest export, and individual CSV files
for all core tables.

This dataset is safe for beta testing, training, and commercial demonstrations.
`
  writeFileSync(readmePath, readme, 'utf8')
  
  return { path: destDir }
}

export async function runValidationSuite(): Promise<void> {
  execSync('npx electron validationTest.js', { stdio: 'inherit' })
}

export async function generateTestDataset(preset: 'small' | 'medium' | 'large'): Promise<{ path: string }> {
  execSync('npx electron validationTest.js', { stdio: 'inherit' })
  const currentDbPath = getDb().path
  const demoPath = join(currentDbPath, '..', 'OSEA_Demo_Dive_Centre.sqlite')
  copyFileSync(currentDbPath, demoPath)
  return { path: demoPath }
}

export function importJson(srcPath: string): ImportSummary {
  const db = getDb()
  const raw = readFileSync(srcPath, 'utf8')
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const meta = payload._meta as { format?: string } | undefined
  if (!meta || meta.format !== 'osea-dive-manager-export') {
    throw new Error('That file is not an OSEA Dive Manager export.')
  }

  const tables: Array<{ name: string; rows: number }> = []
  db.transaction(() => {
    db.exec('PRAGMA foreign_keys = OFF')
    // delete children before parents
    for (const table of [...EXPORT_TABLES].reverse()) {
      db.run(`DELETE FROM ${table}`)
    }
    for (const table of EXPORT_TABLES) {
      const rows = (payload[table] as Array<Record<string, unknown>>) ?? []
      for (const row of rows) {
        const keys = Object.keys(row)
        if (keys.length === 0) continue
        const placeholders = keys.map(() => '?').join(', ')
        db.run(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
          keys.map((k) => row[k] as unknown)
        )
      }
      tables.push({ name: table, rows: rows.length })
    }
    db.exec('PRAGMA foreign_keys = ON')
  })
  return { tables }
}

export function exportCsv(
  destPath: string,
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | number | null>>
): void {
  const escape = (v: string | number | null): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => escape(r[c.key] ?? null)).join(','))
  ]
  // BOM so Excel opens UTF-8 correctly
  writeFileSync(destPath, '﻿' + lines.join('\r\n'), 'utf8')
}
