import type { MigrationEntity, MigrationMapping } from './types'

export const MIGRATION_ENTITY_FIELDS: Record<MigrationEntity, { key: string, label: string, required: boolean }[]> = {
  RentalAssets: [
    { key: 'assetNumber', label: 'Asset/Serial Number', required: true },
    { key: 'model', label: 'Model', required: false },
    { key: 'serialNumber', label: 'Manufacturer Serial', required: false },
    { key: 'size', label: 'Size', required: false },
    { key: 'purchasePrice', label: 'Purchase Price', required: false },
    { key: 'notes', label: 'Notes', required: false }
  ],
  Cylinders: [
    { key: 'assetNumber', label: 'Cylinder Number', required: true },
    { key: 'workingPressure', label: 'Working Pressure', required: false },
    { key: 'visualInspectionDate', label: 'Visual Date', required: false },
    { key: 'hydroTestDate', label: 'Hydro Date', required: false }
  ],
  RetailProducts: [
    { key: 'sku', label: 'SKU/Item Code', required: true },
    { key: 'name', label: 'Product Name', required: true },
    { key: 'barcode', label: 'Barcode', required: false },
    { key: 'costPrice', label: 'Cost Price', required: false },
    { key: 'retailPrice', label: 'Retail Price', required: false },
    { key: 'stockQty', label: 'Opening Stock', required: false }
  ],
  Suppliers: [
    { key: 'name', label: 'Supplier Name', required: true },
    { key: 'contactName', label: 'Contact Name', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false }
  ],
  Customers: [
    { key: 'name', label: 'Customer Name', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'certificationLevel', label: 'Cert Level', required: false }
  ]
}

const FIELD_ALIASES: Record<MigrationEntity, Record<string, string[]>> = {
  RentalAssets: {
    assetNumber: ['asset number', 'asset no', 'asset id', 'serial number'],
    model: ['model'],
    serialNumber: ['serial no', 'serial number', 'manufacturer serial'],
    size: ['size'],
    purchasePrice: ['purchase price', 'cost price', 'purchase cost'],
    notes: ['notes']
  },
  Cylinders: {
    assetNumber: ['cylinder number', 'cylinder no', 'asset number', 'serial number'],
    workingPressure: ['working pressure', 'pressure'],
    visualInspectionDate: ['visual date', 'visual inspection date', 'inspection date'],
    hydroTestDate: ['hydro date', 'test date', 'next test date', 'hydro test date']
  },
  RetailProducts: {
    sku: ['sku', 'stock code', 'item code', 'product code'],
    name: ['product name', 'item name', 'name', 'description'],
    barcode: ['barcode', 'bar code'],
    costPrice: ['cost price', 'cost', 'unit cost'],
    retailPrice: ['retail price', 'selling price', 'sale price'],
    stockQty: ['qty', 'quantity', 'stock qty', 'opening stock', 'on hand']
  },
  Suppliers: {
    name: ['supplier name', 'vendor', 'vendor name', 'name'],
    contactName: ['contact name', 'contact person'],
    email: ['email', 'email address'],
    phone: ['phone', 'telephone', 'mobile']
  },
  Customers: {
    name: ['customer name', 'diver name', 'name'],
    email: ['email', 'email address'],
    phone: ['phone', 'telephone', 'mobile'],
    certificationLevel: ['cert level', 'certification', 'certification level']
  }
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function labelsMatch(left: string, right: string): boolean {
  const a = normalizeLabel(left)
  const b = normalizeLabel(right)
  return a === b || a.includes(b) || b.includes(a)
}

export function autoMapMigrationHeaders(entity: MigrationEntity, headers: string[]): MigrationMapping {
  const mapping: MigrationMapping = {}
  const aliases = FIELD_ALIASES[entity]

  for (const field of MIGRATION_ENTITY_FIELDS[entity]) {
    const candidates = [field.key, field.label, ...(aliases[field.key] ?? [])]
    const match = headers.find((header) => candidates.some((candidate) => labelsMatch(header, candidate)))
    if (match) mapping[field.key] = match
  }

  return mapping
}
