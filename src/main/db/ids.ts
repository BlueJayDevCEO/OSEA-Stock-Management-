import { randomUUID } from 'crypto'
import type { SqlDriver } from './driver'

export function newId(): string {
  return randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Sequential, human-readable document numbers (asset numbers, SKUs,
 * invoices, POs). Must be called inside a transaction for atomicity when
 * combined with the insert that uses the number.
 */
export function nextNumber(db: SqlDriver, counter: string, prefix: string, pad = 5): string {
  db.run('INSERT INTO counters (name, value) VALUES (?, 0) ON CONFLICT(name) DO NOTHING', [counter])
  db.run('UPDATE counters SET value = value + 1 WHERE name = ?', [counter])
  const row = db.get<{ value: number }>('SELECT value FROM counters WHERE name = ?', [counter])
  const n = row ? row.value : 1
  return `${prefix}-${String(n).padStart(pad, '0')}`
}
