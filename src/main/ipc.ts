import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import type { AppStatus, DataDirCheckResult, Result, SetupInput } from '@shared/types'
import { shouldShowDeveloperTools } from '@shared/featureFlags'
import { dbPathFor, defaultDataDir, loadConfig, saveConfig } from './config'
import { isDbOpen, openDatabase, getDb, previewDatabaseAt } from './db'
import * as settingsRepo from './repositories/settings'
import * as catalog from './repositories/catalog'
import * as assets from './repositories/assets'
import * as products from './repositories/products'
import * as sales from './repositories/sales'
import * as pos from './repositories/purchaseOrders'
import * as reports from './repositories/reports'
import * as customFields from './repositories/customFields'
import * as dataAdmin from './repositories/dataAdmin'
import * as migration from './repositories/migration'
import { seedDemoData } from './repositories/demoData'

function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

function handle(channel: string, fn: (...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await (fn as (...a: unknown[]) => unknown)(...args)
      return ok(data)
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Something went wrong.'
      if (message.includes('UNIQUE constraint failed')) {
        message = 'This identifier (barcode, SKU, or name) already exists in the system.'
      } else if (message.includes('FOREIGN KEY constraint failed')) {
        message = 'This item cannot be removed because it is linked to historical records.'
      }
      return { ok: false, error: message } satisfies Result<never>
    }
  })
}

type OpenDialog = (
  win: BrowserWindow,
  options: Electron.OpenDialogOptions
) => Promise<Electron.OpenDialogReturnValue>
type IpcRegister = (channel: string, fn: (...args: never[]) => unknown) => void

export function registerFilePickerIpc(
  getWindow: () => BrowserWindow | null,
  register: IpcRegister = handle,
  openDialog: OpenDialog = (win, options) => dialog.showOpenDialog(win, options)
): void {
  register('app:chooseFile', async (filterName: string, extensions: string[]) => {
    const win = getWindow()
    if (!win) return null
    const result = await openDialog(win, {
      properties: ['openFile'],
      filters: [{ name: filterName, extensions }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  register('app:chooseFiles', async (filterName: string, extensions: string[]) => {
    const win = getWindow()
    if (!win) return []
    const testFiles = process.env['OSEA_TEST_CHOOSE_FILES']
    if (testFiles) return testFiles.split(';').filter(Boolean)
    const result = await openDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: filterName, extensions }]
    })
    return result.canceled ? [] : result.filePaths
  })
}

export function registerMigrationIpc(register: IpcRegister = handle): void {
  register('migration:inspectFiles', migration.inspectFiles)
  register('migration:validateMapping', migration.validateMapping)
  register('migration:importData', migration.importData)
}

function getStatus(): AppStatus {
  const config = loadConfig()
  return {
    configured: !!config && isDbOpen(),
    dataDir: config?.dataDir ?? null,
    dbPath: config ? dbPathFor(config.dataDir) : null,
    provider: config?.provider ?? null,
    version: app.getVersion(),
    isPackaged: app.isPackaged
  }
}

/**
 * Runs first-run (or re-run) setup. Exported standalone — not just registered
 * as an IPC handler — so productionReadinessTest.ts can call it directly and
 * prove the existing-database guard without faking IPC plumbing.
 *
 * Safety invariant: if a database file already exists at the target path,
 * this NEVER applies `input.business` or seeds demo data over it, regardless
 * of what the caller passes — the Setup Wizard is expected to have already
 * warned the customer and offered "use existing" / "choose a different
 * folder" before calling this at all (see checkDataDir / app:checkDataDir).
 */
export function performAppSetup(input: SetupInput): AppStatus {
  const dataDir = input.dataDir && input.dataDir.trim() ? input.dataDir : defaultDataDir()
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  const dbPath = dbPathFor(dataDir)
  const dbAlreadyExisted = existsSync(dbPath)
  openDatabase(dbPath)
  saveConfig({ provider: 'sqlite', dataDir, configuredAt: new Date().toISOString() })
  if (input.business && !dbAlreadyExisted) settingsRepo.updateSettings(input.business)
  if (input.loadDemoData && !dbAlreadyExisted) seedDemoData()
  return getStatus()
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // --- App / setup ---------------------------------------------------------
  handle('app:getStatus', () => getStatus())
  handle('app:getDefaultDataDir', () => defaultDataDir())

  handle('app:setup', (input: SetupInput) => performAppSetup(input))

  handle('app:checkDataDir', (dataDirInput: string | null) => {
    const dataDir = dataDirInput && dataDirInput.trim() ? dataDirInput : defaultDataDir()
    const dbPath = dbPathFor(dataDir)
    const preview = previewDatabaseAt(dbPath)
    const result: DataDirCheckResult = {
      dbPath,
      exists: preview !== null,
      businessName: preview?.businessName ?? null,
      counts: preview?.counts ?? null
    }
    return result
  })

  handle('app:chooseDirectory', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose where your business data will be stored'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  handle(
    'app:chooseSavePath',
    async (defaultName: string, filterName: string, extensions: string[]) => {
      const win = getWindow()
      if (!win) return null
      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultName,
        filters: [{ name: filterName, extensions }]
      })
      return result.canceled ? null : (result.filePath ?? null)
    }
  )

  registerFilePickerIpc(getWindow)

  handle('app:showInFolder', (path: string) => {
    shell.showItemInFolder(path)
  })

  handle('app:printToPdf', async (defaultName: string) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    writeFileSync(result.filePath, pdf)
    return result.filePath
  })

  handle('app:print', () => {
    const win = getWindow()
    win?.webContents.print({ printBackground: true })
  })

  handle('app:getLastPrompt', async () => {
    if (!shouldShowDeveloperTools(app.isPackaged)) return null
    try {
      const fs = require('fs')
      const path = require('path')
      const promptPath = path.join(app.getPath('userData'), 'lastPrompt.txt')
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8')
      }
      return null
    } catch {
      return null
    }
  })

  handle('app:openUserManual', async () => {
    const path = require('path')
    const manualPath = app.isPackaged
      ? path.join(process.resourcesPath, 'docs', 'OSEA-Dive-Manager-User-Manual.pdf')
      : path.join(__dirname, '../../docs', 'OSEA-Dive-Manager-User-Manual.pdf')
    await shell.openPath(manualPath)
  })

  // --- Settings --------------------------------------------------------------
  handle('settings:get', () => settingsRepo.getSettings())
  handle('settings:update', settingsRepo.updateSettings)

  // --- Catalog -----------------------------------------------------------------
  handle('catalog:listCategories', catalog.listCategories)
  handle('catalog:createCategory', catalog.createCategory)
  handle('catalog:updateCategory', catalog.updateCategory)
  handle('catalog:deleteCategory', catalog.deleteCategory)
  handle('catalog:listEquipmentTypes', catalog.listEquipmentTypes)
  handle('catalog:createEquipmentType', catalog.createEquipmentType)
  handle('catalog:updateEquipmentType', catalog.updateEquipmentType)
  handle('catalog:deleteEquipmentType', catalog.deleteEquipmentType)
  handle('catalog:listBrands', catalog.listBrands)
  handle('catalog:createBrand', catalog.createBrand)
  handle('catalog:deleteBrand', catalog.deleteBrand)
  handle('catalog:listSuppliers', catalog.listSuppliers)
  handle('catalog:createSupplier', catalog.createSupplier)
  handle('catalog:updateSupplier', catalog.updateSupplier)
  handle('catalog:setSupplierArchived', catalog.setSupplierArchived)

  // --- Rental assets ---------------------------------------------------------------
  handle('assets:list', assets.listAssets)
  handle('assets:get', assets.getAsset)
  handle('assets:getByNumber', assets.getAssetByNumber)
  handle('assets:create', assets.createAsset)
  handle('assets:update', assets.updateAsset)
  handle('assets:setArchived', assets.setAssetArchived)
  handle('assets:checkOut', assets.checkOutAsset)
  handle('assets:reserve', assets.reserveAsset)
  handle('assets:return', assets.returnAsset)
  handle('assets:setStatus', assets.setAssetStatus)
  handle('assets:completeService', assets.completeService)
  handle('assets:addNote', assets.addAssetNote)
  handle('assets:events', assets.listAssetEvents)

  // --- Retail products ----------------------------------------------------------------
  handle('products:list', products.listProducts)
  handle('products:get', products.getProduct)
  handle('products:getByCode', products.getProductByCode)
  handle('products:create', products.createProduct)
  handle('products:update', products.updateProduct)
  handle('products:setArchived', products.setProductArchived)
  handle('products:adjust', products.applyMovement)
  handle('products:movements', products.listMovements)

  // --- Sales -------------------------------------------------------------------------
  handle('sales:list', sales.listSales)
  handle('sales:get', sales.getSale)
  handle('sales:create', sales.createSale)

  // --- Purchase orders ------------------------------------------------------------------
  handle('po:list', pos.listPurchaseOrders)
  handle('po:get', pos.getPurchaseOrder)
  handle('po:create', pos.createPurchaseOrder)
  handle('po:updateStatus', pos.updatePoStatus)
  handle('po:receive', pos.receivePurchaseOrder)
  handle('po:deleteDraft', pos.deleteDraftPo)

  // --- Dashboard / reports / search ------------------------------------------------------
  handle('reports:dashboard', reports.getDashboardStats)
  handle('reports:run', reports.runReport)
  handle('reports:search', reports.globalSearch)

  // --- Custom fields -----------------------------------------------------------------------
  handle('custom:list', customFields.listCustomFields)
  handle('custom:create', customFields.createCustomField)
  handle('custom:delete', customFields.deleteCustomField)
  handle('custom:values', customFields.getCustomFieldValues)
  handle('custom:setValue', customFields.setCustomFieldValue)

  // --- Data ownership: backup / restore / export / import ------------------------------------
  handle('data:backup', dataAdmin.backupDatabase)
  handle('data:restore', dataAdmin.restoreDatabase)
  handle('data:exportJson', dataAdmin.exportJson)
  handle('data:importJson', dataAdmin.importJson)
  handle('data:exportCsv', dataAdmin.exportCsv)
  // Developer-only tooling (Settings → Developer Tools). Both shell out to
  // dev scripts that don't exist in a packaged build — refuse outright there
  // rather than fail obscurely for a customer. UI also hides the tab (see
  // shouldShowDeveloperTools / SettingsPage.tsx); this is the belt-and-braces
  // server-side guard.
  handle('data:runValidationSuite', () => {
    if (!shouldShowDeveloperTools(app.isPackaged)) {
      throw new Error('Developer tools are not available in this build.')
    }
    return dataAdmin.runValidationSuite()
  })
  handle('data:generateTestDataset', (preset: 'small' | 'medium' | 'large') => {
    if (!shouldShowDeveloperTools(app.isPackaged)) {
      throw new Error('Developer tools are not available in this build.')
    }
    return dataAdmin.generateTestDataset(preset)
  })
  handle('data:exportDemoDatabase', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose where to export the Demo Database'
    })
    if (result.canceled || !result.filePaths[0]) return null
    return dataAdmin.exportDemoDatabase(result.filePaths[0])
  })
  handle('data:dbInfo', () => {
    const db = getDb()
    const tables = ['rental_assets', 'products', 'sales', 'purchase_orders', 'suppliers']
    const counts: Record<string, number> = {}
    for (const t of tables) {
      const row = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)
      counts[t] = row?.n ?? 0
    }
    return { path: db.path, counts }
  })

  // --- Data migration -------------------------------------------------------
  registerMigrationIpc()
}
