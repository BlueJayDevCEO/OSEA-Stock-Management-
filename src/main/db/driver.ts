/**
 * SqlDriver — the only surface the repositories touch.
 *
 * The application never depends on a concrete database technology directly.
 * V1 ships a better-sqlite3 implementation; a PostgreSQL / MySQL / cloud
 * implementation only needs to satisfy this interface (plus the SQL dialect
 * shims documented in docs/ARCHITECTURE.md) for every repository to work
 * unchanged.
 */
import Database from 'better-sqlite3'

export interface RunResult {
  changes: number
}

export interface SqlDriver {
  readonly path: string
  run(sql: string, params?: unknown[]): RunResult
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  exec(sql: string): void
  transaction<T>(fn: () => T): T
  backupTo(destPath: string): Promise<void>
  close(): void
}

export class SqliteDriver implements SqlDriver {
  private db: Database.Database
  readonly path: string

  constructor(dbPath: string) {
    this.path = dbPath
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const info = this.db.prepare(sql).run(...params)
    return { changes: info.changes }
  }

  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[]
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  async backupTo(destPath: string): Promise<void> {
    await this.db.backup(destPath)
  }

  close(): void {
    this.db.close()
  }
}
