import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { app } from 'electron'
import { openDatabase, closeDatabase, getDb } from './db'
import * as xlsx from 'xlsx'
import { inspectFiles, validateMapping, importData } from './repositories/migration'
import { registerFilePickerIpc, registerMigrationIpc } from './ipc'
import { autoMapMigrationHeaders } from '../shared/migration'

function assertMapping(actual: Record<string, string | null>, expected: Record<string, string>): void {
  for (const [field, header] of Object.entries(expected)) {
    if (actual[field] !== header) {
      throw new Error(`Expected ${field} to map to "${header}", got "${actual[field] ?? ''}"`)
    }
  }
}

async function runIpcRegistrationTests() {
  const handlers: Record<string, (...args: any[]) => unknown> = {}
  const register = (channel: string, fn: (...args: never[]) => unknown) => {
    handlers[channel] = fn as (...args: any[]) => unknown
  }
  const fakeWindow = {} as Electron.BrowserWindow

  registerFilePickerIpc(
    () => fakeWindow,
    register,
    async (_win, options) => {
      if (!options.properties?.includes('multiSelections')) {
        throw new Error('Multi-file picker did not request multiSelections')
      }
      if (options.filters?.[0]?.name !== 'Data Files') {
        throw new Error('Multi-file picker filter name was not passed through')
      }
      const extensions = options.filters?.[0]?.extensions ?? []
      for (const ext of ['csv', 'xlsx', 'xls', 'json']) {
        if (!extensions.includes(ext)) {
          throw new Error(`Multi-file picker missing ${ext} filter`)
        }
      }
      return { canceled: false, filePaths: ['one.csv', 'two.xlsx'] }
    }
  )

  if (!handlers['app:chooseFile'] || !handlers['app:chooseFiles']) {
    throw new Error('File picker IPC registration failed')
  }

  const picked = await handlers['app:chooseFiles']('Data Files', ['csv', 'xlsx', 'xls', 'json'])
  if (!Array.isArray(picked) || picked.length !== 2 || picked[1] !== 'two.xlsx') {
    throw new Error('Multi-file picker did not return selected paths')
  }

  const cancelHandlers: Record<string, (...args: any[]) => unknown> = {}
  registerFilePickerIpc(
    () => fakeWindow,
    (channel, fn) => {
      cancelHandlers[channel] = fn as (...args: any[]) => unknown
    },
    async () => ({ canceled: true, filePaths: [] })
  )

  const canceledMulti = await cancelHandlers['app:chooseFiles']('Data Files', ['csv'])
  const canceledSingle = await cancelHandlers['app:chooseFile']('Data Files', ['csv'])
  if (!Array.isArray(canceledMulti) || canceledMulti.length !== 0 || canceledSingle !== null) {
    throw new Error('File picker cancel behavior failed')
  }

  const migrationHandlers: Record<string, (...args: any[]) => unknown> = {}
  registerMigrationIpc((channel, fn) => {
    migrationHandlers[channel] = fn as (...args: any[]) => unknown
  })
  for (const channel of ['migration:inspectFiles', 'migration:validateMapping', 'migration:importData']) {
    if (!migrationHandlers[channel]) {
      throw new Error(`Missing migration IPC handler: ${channel}`)
    }
  }
}

export async function runMigrationTest() {
  console.log('--- Starting Migration Suite ---')
  await runIpcRegistrationTests()
  console.log('IPC picker and migration registration OK')

  const dir = mkdtempSync(join(tmpdir(), 'osea-migration-'))
  const dbPath = join(dir, 'test.db')
  openDatabase(dbPath)

  try {
    const db = getDb()

    const csvPath = join(dir, 'rental_assets.csv')
    const xlsxPath = join(dir, 'retail_products.xlsx')
    const cleanXlsxPath = join(dir, 'retail_products_clean.xlsx')
    const multiSheetXlsxPath = join(dir, 'multi_sheet_stock.xlsx')
    const customerStockPath = join(dir, 'customer_test_stock.xlsx')
    const classificationPath = join(dir, 'classification_cases.xlsx')
    const jsonPath = join(dir, 'suppliers.json')

    writeFileSync(
      csvPath,
      'asset number,model,serial_num\nA-001,Scubapro MK25,SN12345\nA-002,Scubapro MK25,SN12346'
    )

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet([
      { sku: 'P-001', name: 'Mask', costPrice: 10, retailPrice: 20, stockQty: 0 },
      { sku: 'P-002', name: 'Fins', costPrice: 'invalid', retailPrice: 50, stockQty: 5 },
      { sku: 'P-001', name: 'Mask Dup', costPrice: 10, retailPrice: 20, stockQty: 5 }
    ])
    xlsx.utils.book_append_sheet(wb, ws, 'Products')
    xlsx.writeFile(wb, xlsxPath)

    const cleanWb = xlsx.utils.book_new()
    const cleanWs = xlsx.utils.json_to_sheet([
      { sku: 'P-100', name: 'Clean Mask', costPrice: 10, retailPrice: 20, stockQty: 0 }
    ])
    xlsx.utils.book_append_sheet(cleanWb, cleanWs, 'Products')
    xlsx.writeFile(cleanWb, cleanXlsxPath)

    const multiWb = xlsx.utils.book_new()
    const multiWs1 = xlsx.utils.json_to_sheet([
      { assetNumber: 'MS-A-001', model: 'BCD', serialNumber: 'BCD-1' }
    ])
    const multiWs2 = xlsx.utils.json_to_sheet([
      { sku: 'MS-P-001', name: 'Snorkel', costPrice: 5, retailPrice: 15, stockQty: 3 }
    ])
    const emptySheet = xlsx.utils.aoa_to_sheet([])
    xlsx.utils.book_append_sheet(multiWb, multiWs1, 'RentalAssets')
    xlsx.utils.book_append_sheet(multiWb, emptySheet, 'Empty')
    xlsx.utils.book_append_sheet(multiWb, multiWs2, 'RetailProducts')
    xlsx.writeFile(multiWb, multiSheetXlsxPath)

    const customerStockWb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(
      customerStockWb,
      xlsx.utils.json_to_sheet([
        {
          'Stock Code': 'STK-001',
          'Product Name': 'Mask',
          Brand: 'Scubapro',
          Category: 'Masks',
          Qty: 4,
          'Cost Price': 10,
          'Retail Price': 25,
          Barcode: '123456'
        }
      ]),
      'Retail Stock'
    )
    xlsx.utils.book_append_sheet(
      customerStockWb,
      xlsx.utils.json_to_sheet([
        {
          'Asset Number': 'RA-001',
          'Equipment Type': 'BCD',
          Brand: 'Aqualung',
          Model: 'Pro',
          'Serial No': 'SN-001',
          Size: 'M',
          'Purchase Price': 200
        }
      ]),
      'Rental Assets'
    )
    xlsx.writeFile(customerStockWb, customerStockPath)

    const classificationWb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(
      classificationWb,
      xlsx.utils.json_to_sheet([
        {
          'Cylinder Number': 'CYL-001',
          'Serial Number': 'CYL-SN-001',
          'Working Pressure': 232,
          'Test Date': '2026-01-01',
          'Next Test Date': '2027-01-01'
        }
      ]),
      'Cylinder Sheet'
    )
    xlsx.utils.book_append_sheet(
      classificationWb,
      xlsx.utils.json_to_sheet([
        {
          'Supplier Name': 'Aqualung',
          'Contact Name': 'Bob',
          Email: 'bob@example.com',
          Phone: '123'
        }
      ]),
      'Supplier Sheet'
    )
    xlsx.utils.book_append_sheet(
      classificationWb,
      xlsx.utils.json_to_sheet([
        {
          'Customer Name': 'Jane Diver',
          Email: 'jane@example.com',
          Phone: '456',
          'Cert Level': 'Advanced'
        }
      ]),
      'Customer Sheet'
    )
    xlsx.writeFile(classificationWb, classificationPath)

    writeFileSync(
      jsonPath,
      JSON.stringify([
        { vendor: 'Aqualung', contactName: 'Bob' },
        { contactName: 'Missing Name' }
      ])
    )

    const rendererFlowHandlers: Record<string, (...args: any[]) => unknown> = {}
    registerFilePickerIpc(
      () => ({} as Electron.BrowserWindow),
      (channel, fn) => {
        rendererFlowHandlers[channel] = fn as (...args: any[]) => unknown
      },
      async () => ({ canceled: false, filePaths: [csvPath, jsonPath] })
    )
    const selectedPaths = await rendererFlowHandlers['app:chooseFiles']('Data Files', ['csv', 'xlsx', 'xls', 'json'])
    if (!Array.isArray(selectedPaths) || selectedPaths.length !== 2) {
      throw new Error('Selected paths did not return from file picker IPC')
    }
    const rendererPreviews = await inspectFiles(selectedPaths)
    if (
      rendererPreviews.length !== 2 ||
      rendererPreviews[0].fileName !== 'rental_assets.csv' ||
      rendererPreviews[1].fileName !== 'suppliers.json'
    ) {
      throw new Error('Selected paths did not reach migration inspection previews')
    }

    const files = await inspectFiles([
      csvPath,
      xlsxPath,
      cleanXlsxPath,
      multiSheetXlsxPath,
      customerStockPath,
      classificationPath,
      jsonPath
    ])

    if (files.length !== 11) throw new Error('Expected 11 migration previews, including non-empty workbook sheets')

    console.log('Files parsed successfully')

    const rentalFile = files.find(f => f.fileName === 'rental_assets.csv')!
    const productFile = files.find(f => f.fileName === 'retail_products.xlsx')!
    const cleanProductFile = files.find(f => f.fileName === 'retail_products_clean.xlsx')!
    const multiRentalFile = files.find(f => f.fileName === 'multi_sheet_stock.xlsx - RentalAssets')!
    const multiProductFile = files.find(f => f.fileName === 'multi_sheet_stock.xlsx - RetailProducts')!
    const misleadingRetailFile = files.find(f => f.fileName === 'customer_test_stock.xlsx - Retail Stock')!
    const misleadingRentalFile = files.find(f => f.fileName === 'customer_test_stock.xlsx - Rental Assets')!
    const cylinderFile = files.find(f => f.fileName === 'classification_cases.xlsx - Cylinder Sheet')!
    const classificationSupplierFile = files.find(f => f.fileName === 'classification_cases.xlsx - Supplier Sheet')!
    const customerFile = files.find(f => f.fileName === 'classification_cases.xlsx - Customer Sheet')!
    const supplierFile = files.find(f => f.fileName === 'suppliers.json')!

    if (rentalFile.suggestedEntity !== 'RentalAssets') {
      throw new Error('Entity sniffing failed for rental')
    }

    if (productFile.suggestedEntity !== 'RetailProducts') {
      throw new Error('Entity sniffing failed for products')
    }

    if (supplierFile.suggestedEntity !== 'Suppliers') {
      throw new Error('Entity sniffing failed for suppliers')
    }

    if (misleadingRetailFile.suggestedEntity !== 'RetailProducts') {
      throw new Error('Misleading customer filename overrode retail sheet evidence')
    }

    if (misleadingRentalFile.suggestedEntity !== 'RentalAssets') {
      throw new Error('Misleading customer filename overrode rental sheet evidence')
    }

    if (cylinderFile.suggestedEntity !== 'Cylinders') {
      throw new Error('Entity sniffing failed for cylinders')
    }

    if (classificationSupplierFile.suggestedEntity !== 'Suppliers') {
      throw new Error('Entity sniffing failed for supplier headers')
    }

    if (customerFile.suggestedEntity !== 'Customers') {
      throw new Error('Entity sniffing failed for customer headers')
    }

    if (multiRentalFile.rowCount !== 1 || multiProductFile.rowCount !== 1) {
      throw new Error('Multi-sheet workbook did not expose non-empty worksheets independently')
    }

    if (files.some(f => f.fileName === 'multi_sheet_stock.xlsx - Empty')) {
      throw new Error('Empty workbook sheet should not create a migration preview')
    }

    const rentalMapping = {
      assetNumber: 'asset number',
      model: 'model',
      serialNumber: 'serial_num'
    }

    const productMapping = {
      sku: 'sku',
      name: 'name',
      costPrice: 'costPrice',
      retailPrice: 'retailPrice',
      stockQty: 'stockQty'
    }

    const supplierMapping = {
      name: 'vendor',
      contactName: 'contactName'
    }

    assertMapping(autoMapMigrationHeaders('RetailProducts', misleadingRetailFile.headers), {
      sku: 'Stock Code',
      name: 'Product Name',
      stockQty: 'Qty',
      costPrice: 'Cost Price',
      retailPrice: 'Retail Price',
      barcode: 'Barcode'
    })

    assertMapping(autoMapMigrationHeaders('RentalAssets', misleadingRentalFile.headers), {
      assetNumber: 'Asset Number',
      model: 'Model',
      serialNumber: 'Serial No',
      size: 'Size',
      purchasePrice: 'Purchase Price'
    })

    const valid1 = await validateMapping(
      rentalFile.fileId,
      'RentalAssets',
      rentalMapping
    )

    if (valid1.invalidRows.length > 0) {
      throw new Error('Rental validation failed')
    }

    const valid2 = await validateMapping(
      productFile.fileId,
      'RetailProducts',
      productMapping
    )

    if (valid2.invalidRows.length !== 2) {
      throw new Error('Product validation should catch invalid number and duplicate')
    }

    const valid3 = await validateMapping(
      supplierFile.fileId,
      'Suppliers',
      supplierMapping
    )

    if (valid3.invalidRows.length !== 1) {
      throw new Error('Supplier validation should catch missing name')
    }

    const import1 = await importData(
      rentalFile.fileId,
      'RentalAssets',
      rentalMapping,
      false
    )

    if (import1.importedCount !== 2) {
      throw new Error('Expected 2 rental assets to be imported')
    }

    const assetsCount =
      db.get<{ c: number }>('SELECT COUNT(*) AS c FROM rental_assets')?.c

    if (assetsCount !== 2) {
      throw new Error('Rental assets not inserted')
    }

    for (const skipDuplicates of [false, true]) {
      try {
        await importData(
          productFile.fileId,
          'RetailProducts',
          productMapping,
          skipDuplicates
        )

        throw new Error('Invalid product import should have been rejected')
      } catch (e: any) {
        if (e.message !== 'Please resolve invalid rows before importing.') {
          throw e
        }
      }
    }

    const rejectedProductCount =
      db.get<{ c: number }>('SELECT COUNT(*) AS c FROM products')?.c

    if (rejectedProductCount !== 0) {
      throw new Error('Rejected invalid import wrote product rows')
    }

    const cleanImport = await importData(
      cleanProductFile.fileId,
      'RetailProducts',
      productMapping,
      false
    )

    if (cleanImport.importedCount !== 1) {
      throw new Error('Expected clean product import to insert one row')
    }

    const cleanProduct = db.get<{ stock_qty: number }>(
      "SELECT stock_qty FROM products WHERE sku='P-100'"
    )

    if (cleanProduct?.stock_qty !== 0) {
      throw new Error('Zero stock preservation failed')
    }

    const productCount =
      db.get<{ c: number }>('SELECT COUNT(*) AS c FROM products')?.c

    if (productCount !== 1) {
      throw new Error('Retail products overlap error')
    }

    console.log('Invalid-row blocking + zero preservation + separation OK')
    console.log('--- Migration Suite Passed ---')
  } finally {
    closeDatabase()
    rmSync(dir, { recursive: true, force: true })
    app.quit()
  }
}
