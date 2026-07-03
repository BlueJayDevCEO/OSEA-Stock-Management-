import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { app } from 'electron'
import { openDatabase, closeDatabase, getDb } from './db'
import * as xlsx from 'xlsx'
import { inspectFiles, validateMapping, importData } from './repositories/migration'

export async function runMigrationTest() {
  console.log('--- Starting Migration Suite ---')
  const dir = mkdtempSync(join(tmpdir(), 'osea-migration-'))
  const dbPath = join(dir, 'test.db')
  openDatabase(dbPath)

  try {
    const db = getDb()

    const csvPath = join(dir, 'rental_assets.csv')
    const xlsxPath = join(dir, 'retail_products.xlsx')
    const cleanXlsxPath = join(dir, 'retail_products_clean.xlsx')
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

    writeFileSync(
      jsonPath,
      JSON.stringify([
        { vendor: 'Aqualung', contactName: 'Bob' },
        { contactName: 'Missing Name' }
      ])
    )

    const files = await inspectFiles([
      csvPath,
      xlsxPath,
      cleanXlsxPath,
      jsonPath
    ])

    if (files.length !== 4) throw new Error('Expected 4 files')

    console.log('Files parsed successfully')

    const rentalFile = files.find(f => f.fileName === 'rental_assets.csv')!
    const productFile = files.find(f => f.fileName === 'retail_products.xlsx')!
    const cleanProductFile = files.find(f => f.fileName === 'retail_products_clean.xlsx')!
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