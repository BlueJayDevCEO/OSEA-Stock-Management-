/**
 * Headless test: `OSEA Dive Manager --production-readiness-test`
 *
 * Covers the two pilot-readiness fixes found in UAT that don't belong in the
 * general smoke/migration suites:
 *
 *  1. Existing-database detection (previewDatabaseAt / app:checkDataDir) and
 *     the app:setup guarantee that re-running setup against a folder that
 *     already has a database never overwrites its business settings or
 *     demo-seeds over real data.
 *  2. The Developer Tools feature gate is off for packaged/customer builds.
 */
import { app } from 'electron'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { closeDatabase, previewDatabaseAt } from './db'
import * as settingsRepo from './repositories/settings'
import { dbPathFor } from './config'
import { performAppSetup } from './ipc'
import { shouldShowDeveloperTools } from '../shared/featureFlags'

function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(`PRODUCTION READINESS FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

export async function runProductionReadinessTest(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'osea-prod-readiness-'))
  const dbPath = dbPathFor(dir)

  try {
    console.log('• Existing-database detection')
    assert(previewDatabaseAt(dbPath) === null, 'no database reported for an empty folder')

    console.log('• First-time setup applies the business the customer entered')
    performAppSetup({
      provider: 'sqlite',
      dataDir: dir,
      business: {
        businessName: 'Original Dive Centre',
        currency: 'GBP',
        currencySymbol: '£',
        defaultVatRate: 17.5,
        staffName: 'Priya'
      },
      loadDemoData: false
    })
    assert(settingsRepo.getSettings().businessName === 'Original Dive Centre', 'first setup applied the business name')
    closeDatabase()

    console.log('• previewDatabaseAt reads the existing database without opening it for writes')
    const preview = previewDatabaseAt(dbPath)
    assert(preview !== null, 'existing database is detected')
    assert(
      preview?.businessName === 'Original Dive Centre',
      `preview reads the real business name (got "${preview?.businessName}")`
    )
    assert(preview?.counts != null && preview.counts.rental_assets === 0, 'preview reads table counts')

    console.log('• Re-running setup against the same folder never overwrites its settings')
    performAppSetup({
      provider: 'sqlite',
      dataDir: dir,
      business: {
        businessName: 'Overwritten Dive Centre',
        currency: 'USD',
        currencySymbol: '$',
        defaultVatRate: 0,
        staffName: 'Someone Else'
      },
      loadDemoData: true
    })
    const after = settingsRepo.getSettings()
    assert(after.businessName === 'Original Dive Centre', 'business name was not overwritten')
    assert(after.currency === 'GBP', 'currency was not overwritten')
    assert(after.defaultVatRate === 17.5, 'VAT rate was not overwritten')
    assert(after.staffName === 'Priya', 'staff name was not overwritten')
    closeDatabase()

    console.log('• Developer Tools feature gate')
    assert(shouldShowDeveloperTools(false) === true, 'visible in a dev/unpackaged build')
    assert(shouldShowDeveloperTools(true) === false, 'hidden in a packaged/customer build')

    console.log('\nPRODUCTION READINESS TEST PASSED ✔')
  } finally {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
  }
  app.exit(0)
}
