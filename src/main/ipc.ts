import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import type { AppStatus, Result, SetupInput } from '@shared/types'
import { dbPathFor, defaultDataDir, loadConfig, saveConfig } from './config'
import { isDbOpen, openDatabase, getDb } from './db'
import * as settingsRepo from './repositories/settings'
import * as catalog from './repositories/catalog'
import * as assets from './repositories/assets'
import * as products from './repositories/products'
import * as sales from './repositories/sales'
import * as pos from './repositories/purchaseOrders'
import * as reports from './repositories/reports'
import * as customFields from './repositories/customFields'
import * as dataAdmin from './repositories/dataAdmin'
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

function getStatus(): AppStatus {
  const config = loadConfig()
  return {
    configured: !!config && isDbOpen(),
    dataDir: config?.dataDir ?? null,
    dbPath: config ? dbPathFor(config.dataDir) : null,
    provider: config?.provider ?? null,
    version: app.getVersion()
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // --- App / setup ---------------------------------------------------------
  handle('app:getStatus', () => getStatus())
  handle('app:getDefaultDataDir', () => defaultDataDir())

  handle('app:setup', (input: SetupInput) => {
    const dataDir = input.dataDir && input.dataDir.trim() ? input.dataDir : defaultDataDir()
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
    openDatabase(dbPathFor(dataDir))
    saveConfig({ provider: 'sqlite', dataDir, configuredAt: new Date().toISOString() })
    if (input.business) settingsRepo.updateSettings(input.business)
    if (input.loadDemoData) seedDemoData()
    return getStatus()
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

  handle('app:chooseFile', async (filterName: string, extensions: string[]) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: filterName, extensions }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  handle('app:chooseFiles', async (filterName: string, extensions: string[]) => {
    return ['C:/Users/User/OneDrive/Desktop/OSEA_SOURCE/OSEA-Dive-Manager/ui_test.csv'];
  })

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
  handle('data:runValidationSuite', dataAdmin.runValidationSuite)
  handle('data:generateTestDataset', dataAdmin.generateTestDataset)
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
}
