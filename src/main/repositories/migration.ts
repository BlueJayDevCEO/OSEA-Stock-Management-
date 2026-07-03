import * as fs from 'fs'
import * as path from 'path'
import * as xlsx from 'xlsx'
import { getDb } from '../db'
import { newId, nowIso } from '../db/ids'
import type {
  MigrationEntity,
  MigrationFilePreview,
  MigrationMapping,
  ValidationResult,
  ImportSummaryResult,
  ValidationRowError,
  DuplicateMatch
} from '../../shared/types'
import { createAsset } from './assets'
import { createProduct } from './products'
import { updateCylinderDetails } from './cylinders'
import { createSupplier } from './catalog'
import { createCustomer } from './customers'

// Simple in-memory cache for the migration session
const activeFiles: Record<string, {
  filePath: string
  headers: string[]
  rows: Record<string, any>[]
}> = {}

function normalizeEvidence(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function hasEvidence(values: string[], aliases: string[]): boolean {
  const normalizedAliases = aliases.map(normalizeEvidence)
  return values.some((value) => {
    const normalized = normalizeEvidence(value)
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized))
  })
}

function addEvidence(scores: Record<MigrationEntity, number>, entity: MigrationEntity, points: number, matched: boolean): void {
  if (matched) scores[entity] += points
}

function sniffEntity(headers: string[], sourceName: string, parentFileName = ''): MigrationEntity | null {
  const source = [sourceName]
  const parent = [parentFileName]
  const scores: Record<MigrationEntity, number> = {
    RentalAssets: 0,
    Cylinders: 0,
    RetailProducts: 0,
    Suppliers: 0,
    Customers: 0
  }

  addEvidence(scores, 'RetailProducts', 30, hasEvidence(source, ['retail stock', 'retail products', 'products', 'stock']))
  addEvidence(scores, 'RentalAssets', 30, hasEvidence(source, ['rental assets', 'rental equipment', 'assets']))
  addEvidence(scores, 'Cylinders', 35, hasEvidence(source, ['cylinders', 'cylinder stock']))
  addEvidence(scores, 'Suppliers', 35, hasEvidence(source, ['suppliers', 'vendors']))
  addEvidence(scores, 'Customers', 35, hasEvidence(source, ['customers', 'divers']))

  addEvidence(scores, 'RetailProducts', 25, hasEvidence(headers, ['sku', 'stock code', 'item code', 'product code']))
  addEvidence(scores, 'RetailProducts', 20, hasEvidence(headers, ['product name', 'item name']))
  addEvidence(scores, 'RetailProducts', 15, hasEvidence(headers, ['cost price', 'unit cost']))
  addEvidence(scores, 'RetailProducts', 15, hasEvidence(headers, ['retail price', 'selling price']))
  addEvidence(scores, 'RetailProducts', 10, hasEvidence(headers, ['qty', 'quantity', 'stock qty', 'opening stock', 'barcode']))

  addEvidence(scores, 'RentalAssets', 30, hasEvidence(headers, ['asset number', 'asset no', 'asset id']))
  addEvidence(scores, 'RentalAssets', 15, hasEvidence(headers, ['equipment type', 'model']))
  addEvidence(scores, 'RentalAssets', 10, hasEvidence(headers, ['serial no', 'serial number', 'size', 'purchase price']))

  addEvidence(scores, 'Cylinders', 35, hasEvidence(headers, ['cylinder number', 'cylinder no']))
  addEvidence(scores, 'Cylinders', 25, hasEvidence(headers, ['working pressure']))
  addEvidence(scores, 'Cylinders', 20, hasEvidence(headers, ['test date', 'next test date', 'hydro', 'visual inspection date', 'valve']))

  addEvidence(scores, 'Suppliers', 35, hasEvidence(headers, ['supplier name', 'vendor', 'vendor name']))
  addEvidence(scores, 'Suppliers', 10, hasEvidence(headers, ['contact name', 'contact person']))

  addEvidence(scores, 'Customers', 35, hasEvidence(headers, ['customer name', 'diver name']))
  addEvidence(scores, 'Customers', 25, hasEvidence(headers, ['cert level', 'certification', 'certification level', 'waiver']))

  addEvidence(scores, 'RetailProducts', 5, hasEvidence(parent, ['retail', 'product', 'stock']))
  addEvidence(scores, 'RentalAssets', 5, hasEvidence(parent, ['rental', 'asset', 'equipment']))
  addEvidence(scores, 'Cylinders', 5, hasEvidence(parent, ['cylinder']))
  addEvidence(scores, 'Suppliers', 5, hasEvidence(parent, ['supplier', 'vendor']))
  addEvidence(scores, 'Customers', 3, hasEvidence(parent, ['customer', 'diver']))

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]) as Array<[MigrationEntity, number]>

  return ranked[0][1] > 0 ? ranked[0][0] : null
}

export async function inspectFiles(paths: string[]): Promise<MigrationFilePreview[]> {
  const previews: MigrationFilePreview[] = []

  for (const p of paths) {
    const ext = path.extname(p).toLowerCase()
    const fileName = path.basename(p)
    const parsedSources: Array<{ fileName: string, sourceName: string, parentFileName: string, rows: Record<string, any>[], headers: string[] }> = []

    try {
      if (ext === '.json') {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
        const rows = Array.isArray(data) ? data : [data]
        parsedSources.push({
          fileName,
          sourceName: fileName,
          parentFileName: fileName,
          rows,
          headers: rows.length > 0 ? Object.keys(rows[0]) : []
        })
      } else if (ext === '.xlsx' || ext === '.xls') {
        const workbook = xlsx.readFile(p)
        const nonEmptySheets = workbook.SheetNames
          .map((sheetName) => {
            const sheet = workbook.Sheets[sheetName]
            const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })
            return {
              fileName: workbook.SheetNames.length > 1 ? `${fileName} - ${sheetName}` : fileName,
              sourceName: sheetName,
              parentFileName: fileName,
              rows,
              headers: rows.length > 0 ? Object.keys(rows[0]) : []
            }
          })
          .filter((source) => source.rows.length > 0)

        parsedSources.push(...nonEmptySheets)
      } else {
        const workbook = xlsx.readFile(p)
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })
        parsedSources.push({
          fileName,
          sourceName: fileName,
          parentFileName: fileName,
          rows,
          headers: rows.length > 0 ? Object.keys(rows[0]) : []
        })
      }
    } catch (e: any) {
      const reason = e instanceof Error ? e.message : String(e)
      console.error('Failed to parse file:', p, e)
      throw new Error(`Failed to parse ${path.basename(p)}: ${reason}`)
    }

    if (parsedSources.length === 0) {
      parsedSources.push({ fileName, sourceName: fileName, parentFileName: fileName, rows: [], headers: [] })
    }

    for (const source of parsedSources) {
      const fileId = newId()
      activeFiles[fileId] = { filePath: p, headers: source.headers, rows: source.rows }

      const suggestedEntity = sniffEntity(source.headers, source.sourceName, source.parentFileName)

      previews.push({
        fileId,
        filePath: p,
        fileName: source.fileName,
        headers: source.headers,
        suggestedEntity,
        rowCount: source.rows.length,
        previewRows: source.rows.slice(0, 3)
      })
    }
  }

  return previews
}

function extractMappedValue(row: Record<string, any>, oseaField: string, mapping: MigrationMapping): any {
  const header = mapping[oseaField]
  if (!header) return null
  return row[header]
}

function parseOptionalNumber(val: any, fieldName: string): number | null {
  if (val === null || val === undefined || val === '') return null
  const parsed = Number(val)
  if (isNaN(parsed)) throw new Error(`Invalid numeric value in ${fieldName}`)
  return parsed
}

function parseRequiredNumber(val: any, fieldName: string): number {
  if (val === null || val === undefined || val === '') return 0
  const parsed = Number(val)
  if (isNaN(parsed)) throw new Error(`Invalid numeric value in ${fieldName}`)
  return parsed
}

export async function validateMapping(fileId: string, entity: MigrationEntity, mapping: MigrationMapping): Promise<ValidationResult> {
  const file = activeFiles[fileId]
  if (!file) throw new Error('File not found in active session')

  const invalidRows: ValidationRowError[] = []
  const duplicates: DuplicateMatch[] = []
  let validCount = 0

  const db = getDb()

  file.rows.forEach((row, i) => {
    const rowNum = i + 1
    const errors: string[] = []

    try {
      if (entity === 'RentalAssets' || entity === 'Cylinders') {
        const assetNumber = extractMappedValue(row, 'assetNumber', mapping)
        if (!assetNumber) errors.push('Missing required field: assetNumber')

        if (assetNumber) {
          const existing = db.get<{id: string}>('SELECT id FROM rental_assets WHERE asset_number = ?', [String(assetNumber).trim()])
          if (existing) {
            duplicates.push({ row: rowNum, conflictField: 'assetNumber', conflictValue: String(assetNumber), existingId: existing.id })
          }
        }
      } else if (entity === 'RetailProducts') {
        const sku = extractMappedValue(row, 'sku', mapping)
        const name = extractMappedValue(row, 'name', mapping)
        if (!sku) errors.push('Missing required field: sku')
        if (!name) errors.push('Missing required field: name')

        try {
          parseRequiredNumber(extractMappedValue(row, 'costPrice', mapping), 'Cost Price')
          parseRequiredNumber(extractMappedValue(row, 'retailPrice', mapping), 'Retail Price')
          parseRequiredNumber(extractMappedValue(row, 'stockQty', mapping), 'Opening Stock')
        } catch (e: any) {
          errors.push(e.message)
        }

        if (sku) {
          const existing = db.get<{id: string}>('SELECT id FROM products WHERE sku = ?', [String(sku).trim()])
          if (existing) {
            duplicates.push({ row: rowNum, conflictField: 'sku', conflictValue: String(sku), existingId: existing.id })
          }
        }
      } else if (entity === 'Suppliers') {
        const name = extractMappedValue(row, 'name', mapping)
        if (!name) errors.push('Missing required field: name')
      } else if (entity === 'Customers') {
        const name = extractMappedValue(row, 'name', mapping)
        if (!name) errors.push('Missing required field: name')
      }

    } catch (e: any) {
      errors.push(e.message || 'Unknown validation error')
    }

    if (errors.length > 0) {
      invalidRows.push({ row: rowNum, errors })
    } else {
      validCount++
    }
  })

  // Also check for duplicates within the file itself
  if (entity === 'RentalAssets' || entity === 'Cylinders') {
    const seen = new Set()
    file.rows.forEach((row, i) => {
      const val = String(extractMappedValue(row, 'assetNumber', mapping)).trim()
      if (val && seen.has(val)) {
         invalidRows.push({ row: i+1, errors: ['Duplicate assetNumber within file'] })
         validCount-- // roughly adjust
      }
      if (val) seen.add(val)
    })
  } else if (entity === 'RetailProducts') {
    const seen = new Set()
    file.rows.forEach((row, i) => {
      const val = String(extractMappedValue(row, 'sku', mapping)).trim()
      if (val && seen.has(val)) {
         invalidRows.push({ row: i+1, errors: ['Duplicate sku within file'] })
         // adjust valid count if it was valid before
      }
      if (val) seen.add(val)
    })
  }

  return { validCount, invalidRows, duplicates, totalRows: file.rows.length }
}

export async function importData(fileId: string, entity: MigrationEntity, mapping: MigrationMapping, skipDuplicates: boolean): Promise<ImportSummaryResult> {
  const file = activeFiles[fileId]
  if (!file) throw new Error('File not found in active session')

  const validation = await validateMapping(fileId, entity, mapping)
  if (validation.invalidRows.length > 0) {
     throw new Error('Please resolve invalid rows before importing.')
  }

  const db = getDb()
  const duplicateRows = new Set(validation.duplicates.map(d => d.row))
  const invalidRows = new Set(validation.invalidRows.map(i => i.row))

  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0
  const errors: string[] = []

  try {
    db.transaction(() => {
      file.rows.forEach((row, i) => {
        const rowNum = i + 1
        if (invalidRows.has(rowNum)) {
          skippedCount++
          return
        }
        if (duplicateRows.has(rowNum)) {
          if (skipDuplicates) {
            skippedCount++
            return
          }
        }

        try {
          if (entity === 'RentalAssets' || entity === 'Cylinders') {
            const assetNumber = String(extractMappedValue(row, 'assetNumber', mapping)).trim()
            const model = extractMappedValue(row, 'model', mapping) || null
            const size = extractMappedValue(row, 'size', mapping) || null
            const serialNumber = extractMappedValue(row, 'serialNumber', mapping) || null

            const assets = createAsset({
              assetNumber,
              categoryId: null,
              equipmentTypeId: null,
              brandId: null,
              supplierId: null,
              model: model ? String(model) : null,
              size: size ? String(size) : null,
              colour: null,
              serialNumber: serialNumber ? String(serialNumber) : null,
              purchaseDate: null,
              purchasePrice: parseOptionalNumber(extractMappedValue(row, 'purchasePrice', mapping), 'Purchase Price'),
              replacementValue: 0,
              warrantyExpiry: null,
              condition: 'good',
              notes: extractMappedValue(row, 'notes', mapping) ? String(extractMappedValue(row, 'notes', mapping)) : null,
              photo: null,
              serviceIntervalDays: null,
              lastServiceDate: null
            }, 1)

            if (entity === 'Cylinders') {
              updateCylinderDetails(assets[0].id, {
                visualInspectionDate: extractMappedValue(row, 'visualInspectionDate', mapping) || null,
                hydroTestDate: extractMappedValue(row, 'hydroTestDate', mapping) || null,
                workingPressure: extractMappedValue(row, 'workingPressure', mapping) || null
              })
            }
          } else if (entity === 'RetailProducts') {
            const sku = String(extractMappedValue(row, 'sku', mapping)).trim()
            const name = String(extractMappedValue(row, 'name', mapping)).trim()
            const costPrice = parseRequiredNumber(extractMappedValue(row, 'costPrice', mapping), 'Cost Price')
            const retailPrice = parseRequiredNumber(extractMappedValue(row, 'retailPrice', mapping), 'Retail Price')
            const stockQty = parseRequiredNumber(extractMappedValue(row, 'stockQty', mapping), 'Opening Stock')

            createProduct({
              sku,
              barcode: extractMappedValue(row, 'barcode', mapping) || null,
              name,
              brandId: null,
              categoryId: null,
              supplierId: null,
              costPrice,
              retailPrice,
              vatRate: 0,
              openingStock: stockQty,
              minStock: 0,
              maxStock: null,
              shelfLocation: null,
              description: null
            })
          } else if (entity === 'Suppliers') {
            createSupplier({
              name: String(extractMappedValue(row, 'name', mapping)).trim(),
              contactName: extractMappedValue(row, 'contactName', mapping) || null,
              email: extractMappedValue(row, 'email', mapping) || null,
              phone: extractMappedValue(row, 'phone', mapping) || null
            })
          } else if (entity === 'Customers') {
            createCustomer({
              name: String(extractMappedValue(row, 'name', mapping)).trim(),
              email: extractMappedValue(row, 'email', mapping) || null,
              phone: extractMappedValue(row, 'phone', mapping) || null,
              certificationLevel: extractMappedValue(row, 'certificationLevel', mapping) || null,
              bcdSize: null,
              suitSize: null,
              waiverStatus: 'none',
              notes: extractMappedValue(row, 'notes', mapping) ? String(extractMappedValue(row, 'notes', mapping)) : null
            })
          }
          importedCount++
        } catch (e: any) {
          failedCount++
          errors.push(`Row ${rowNum}: ${e.message}`)
          throw e // Rollback transaction
        }
      })
    })
  } catch (e: any) {
    // If we threw during transaction, it rolls back
    return { importedCount: 0, skippedCount, failedCount, errors: [e.message] }
  }

  return { importedCount, skippedCount, failedCount, errors }
}
