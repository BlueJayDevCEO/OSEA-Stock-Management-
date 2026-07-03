import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Application config lives in the OS app-data folder and only records WHERE
 * the customer keeps their business data. The data itself (the SQLite file)
 * lives wherever they chose — their machine, their NAS, their synced drive.
 */
export interface AppConfig {
  provider: 'sqlite'
  dataDir: string
  configuredAt: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function loadConfig(): AppConfig | null {
  // Test/CI override: point the app at an existing data directory without
  // touching the real per-user config.
  const envDir = process.env['OSEA_DATA_DIR']
  if (envDir) {
    return { provider: 'sqlite', dataDir: envDir, configuredAt: new Date().toISOString() }
  }
  try {
    const p = configPath()
    if (!existsSync(p)) return null
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as AppConfig
    if (!parsed.dataDir) return null
    return parsed
  } catch {
    return null
  }
}

export function saveConfig(config: AppConfig): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

export function defaultDataDir(): string {
  return join(app.getPath('documents'), 'OSEA Dive Manager')
}

export function dbPathFor(dataDir: string): string {
  return join(dataDir, 'osea-dive-manager.db')
}
