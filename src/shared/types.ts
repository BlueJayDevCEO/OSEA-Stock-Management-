/**
 * OSEA Dive Manager — shared domain types.
 *
 * These types form the contract between the main process (repositories),
 * the preload bridge and the renderer. They are database-agnostic: any
 * future storage provider implements repositories that speak these types.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const RENTAL_STATUSES = [
  'available',
  'reserved',
  'checked_out',
  'returned',
  'cleaning',
  'inspection',
  'servicing',
  'damaged',
  'lost',
  'retired'
] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

export const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'unusable'] as const
export type ConditionRating = (typeof CONDITIONS)[number]

export const CATEGORY_SCOPES = ['rental', 'retail', 'both'] as const
export type CategoryScope = (typeof CATEGORY_SCOPES)[number]

export const MOVEMENT_TYPES = [
  'initial',
  'sale',
  'delivery',
  'adjustment',
  'damage',
  'customer_return',
  'transfer',
  'loss',
  'po_receipt'
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const PO_STATUSES = ['draft', 'sent', 'partial', 'completed', 'cancelled'] as const
export type PoStatus = (typeof PO_STATUSES)[number]

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'voucher', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const RENTAL_EVENT_TYPES = [
  'created',
  'reserved',
  'checked_out',
  'returned',
  'inspection',
  'cleaning',
  'service',
  'damage_reported',
  'status_change',
  'condition_change',
  'note'
] as const
export type RentalEventType = (typeof RENTAL_EVENT_TYPES)[number]

export const CUSTOM_FIELD_ENTITIES = ['rental_asset', 'product'] as const
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number]

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select'] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

// ---------------------------------------------------------------------------
// Catalog entities
// ---------------------------------------------------------------------------

export interface Category {
  id: string
  name: string
  scope: CategoryScope
  isSystem: boolean
  createdAt: string
}

export interface EquipmentType {
  id: string
  name: string
  categoryId: string | null
  categoryName?: string | null
  createdAt: string
}

export interface Brand {
  id: string
  name: string
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  archived: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Rental inventory
// ---------------------------------------------------------------------------

export interface RentalAsset {
  id: string
  assetNumber: string
  equipmentTypeId: string | null
  equipmentTypeName?: string | null
  categoryId: string | null
  categoryName?: string | null
  brandId: string | null
  brandName?: string | null
  supplierId: string | null
  supplierName?: string | null
  model: string | null
  size: string | null
  colour: string | null
  serialNumber: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  replacementValue: number | null
  warrantyExpiry: string | null
  status: RentalStatus
  condition: ConditionRating
  notes: string | null
  photo: string | null
  serviceIntervalDays: number | null
  lastServiceDate: string | null
  nextServiceDate: string | null
  currentRenter: string | null
  dueBack: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface RentalAssetInput {
  equipmentTypeId?: string | null
  categoryId?: string | null
  brandId?: string | null
  supplierId?: string | null
  model?: string | null
  size?: string | null
  colour?: string | null
  serialNumber?: string | null
  purchaseDate?: string | null
  purchasePrice?: number | null
  replacementValue?: number | null
  warrantyExpiry?: string | null
  condition?: ConditionRating
  notes?: string | null
  photo?: string | null
  serviceIntervalDays?: number | null
  lastServiceDate?: string | null
  nextServiceDate?: string | null
}

export interface RentalEvent {
  id: string
  assetId: string
  eventType: RentalEventType
  fromStatus: RentalStatus | null
  toStatus: RentalStatus | null
  customerName: string | null
  staffName: string | null
  dueDate: string | null
  condition: ConditionRating | null
  notes: string | null
  createdAt: string
}

export interface AssetFilters {
  search?: string
  status?: RentalStatus | 'all'
  categoryId?: string
  equipmentTypeId?: string
  brandId?: string
  includeArchived?: boolean
  page?: number
  limit?: number
}

export interface CheckoutInput {
  customerName: string
  staffName?: string | null
  dueBack?: string | null
  notes?: string | null
}

// ---------------------------------------------------------------------------
// Retail inventory
// ---------------------------------------------------------------------------

export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  brandId: string | null
  brandName?: string | null
  categoryId: string | null
  categoryName?: string | null
  supplierId: string | null
  supplierName?: string | null
  costPrice: number
  retailPrice: number
  vatRate: number
  stockQty: number
  minStock: number
  maxStock: number | null
  shelfLocation: string | null
  description: string | null
  image: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  name: string
  barcode?: string | null
  brandId?: string | null
  categoryId?: string | null
  supplierId?: string | null
  costPrice?: number
  retailPrice?: number
  vatRate?: number
  minStock?: number
  maxStock?: number | null
  shelfLocation?: string | null
  description?: string | null
  image?: string | null
  /** Only used on create — opening stock, recorded as an 'initial' movement */
  openingStock?: number
}

export interface ProductFilters {
  search?: string
  categoryId?: string
  brandId?: string
  supplierId?: string
  stockLevel?: 'all' | 'low' | 'out' | 'in_stock'
  includeArchived?: boolean
  page?: number
  limit?: number
}

export interface StockMovement {
  id: string
  productId: string
  productName?: string
  sku?: string
  movementType: MovementType
  qtyChange: number
  qtyAfter: number
  reference: string | null
  notes: string | null
  staffName: string | null
  createdAt: string
}

export interface StockAdjustmentInput {
  productId: string
  movementType: MovementType
  qtyChange: number
  reference?: string | null
  notes?: string | null
  staffName?: string | null
}

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

export interface PurchaseOrderLine {
  id: string
  poId: string
  productId: string
  productName?: string
  sku?: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string | null
  supplierName?: string | null
  status: PoStatus
  orderDate: string
  expectedDate: string | null
  notes: string | null
  lines: PurchaseOrderLine[]
  totalCost: number
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderInput {
  supplierId?: string | null
  expectedDate?: string | null
  notes?: string | null
  lines: Array<{ productId: string; qtyOrdered: number; unitCost: number }>
}

export interface ReceiveLineInput {
  lineId: string
  qtyReceived: number
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export interface SaleLine {
  id: string
  saleId: string
  productId: string | null
  productName: string
  sku: string
  qty: number
  unitPrice: number
  unitCost: number
  vatRate: number
  lineTotal: number
}

export interface Sale {
  id: string
  invoiceNumber: string
  customerName: string | null
  staffName: string | null
  saleDate: string
  subtotal: number
  discountAmount: number
  vatAmount: number
  total: number
  paymentMethod: PaymentMethod
  notes: string | null
  lines: SaleLine[]
  profit?: number
  createdAt: string
}

export interface SaleInput {
  customerName?: string | null
  staffName?: string | null
  discountAmount?: number
  paymentMethod: PaymentMethod
  notes?: string | null
  lines: Array<{ productId: string; qty: number; unitPrice?: number }>
}

export interface SaleFilters {
  search?: string
  from?: string
  to?: string
  paymentMethod?: PaymentMethod | 'all'
  page?: number
  limit?: number
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export interface CustomFieldDef {
  id: string
  entity: CustomFieldEntity
  name: string
  fieldType: CustomFieldType
  options: string[]
  createdAt: string
}

export interface CustomFieldValue {
  fieldId: string
  fieldName: string
  fieldType: CustomFieldType
  options: string[]
  value: string | null
}

// ---------------------------------------------------------------------------
// Dashboard, reports, search
// ---------------------------------------------------------------------------

export interface DashboardStats {
  rentalAssetCount: number
  rentalValueTotal: number
  rentalStatusCounts: Record<string, number>
  retailStockValueCost: number
  retailStockValueRetail: number
  retailProductCount: number
  lowStockCount: number
  outOfStockCount: number
  salesTodayTotal: number
  salesTodayCount: number
  salesMonthTotal: number
  salesMonthProfit: number
  serviceDueCount: number
  overdueRentals: number
  recentActivity: ActivityItem[]
  salesLast14Days: Array<{ date: string; total: number }>
}

export interface ActivityItem {
  id: string
  kind: 'sale' | 'movement' | 'rental_event' | 'po'
  title: string
  detail: string
  createdAt: string
}

export interface SearchResultItem {
  kind: 'asset' | 'product' | 'sale' | 'po' | 'supplier'
  id: string
  title: string
  subtitle: string
  code: string
  status?: string
}

export interface ReportRequest {
  report:
    | 'inventory_value'
    | 'rental_utilisation'
    | 'equipment_status'
    | 'service_due'
    | 'sales'
    | 'profit'
    | 'supplier'
    | 'purchases'
    | 'damage'
    | 'low_stock'
    | 'out_of_stock'
  from?: string
  to?: string
}

export interface ReportResult {
  title: string
  generatedAt: string
  columns: Array<{ key: string; label: string; align?: 'left' | 'right'; format?: 'money' | 'number' | 'date' | 'percent' }>
  rows: Array<Record<string, string | number | null>>
  summary?: Array<{ label: string; value: string }>
}

// ---------------------------------------------------------------------------
// Settings / setup
// ---------------------------------------------------------------------------

export interface BusinessSettings {
  businessName: string
  currency: string
  currencySymbol: string
  defaultVatRate: number
  assetPrefix: string
  skuPrefix: string
  invoicePrefix: string
  poPrefix: string
  staffName: string
}

export interface AppStatus {
  configured: boolean
  dataDir: string | null
  dbPath: string | null
  provider: 'sqlite' | null
  version: string
}

export interface SetupInput {
  provider: 'sqlite'
  dataDir: string | null // null = use default app-data location
  business: Partial<BusinessSettings>
  loadDemoData: boolean
}

export interface BackupResult {
  path: string
  sizeBytes: number
}

export interface ImportSummary {
  tables: Array<{ name: string; rows: number }>
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type LabelTemplate = 'a4_grid_24' | 'a4_grid_12' | 'thermal_62x29' | 'thermal_51x25'

export interface LabelItem {
  id: string
  kind: 'asset' | 'product'
  code: string // asset number or SKU — encoded in the QR
  title: string
  subtitle: string
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export interface Ok<T> {
  ok: true
  data: T
}
export interface Err {
  ok: false
  error: string
}
export type Result<T> = Ok<T> | Err

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  checked_out: 'Checked Out',
  returned: 'Returned',
  cleaning: 'Cleaning',
  inspection: 'Inspection',
  servicing: 'Servicing',
  damaged: 'Damaged',
  lost: 'Lost',
  retired: 'Retired'
}

export const CONDITION_LABELS: Record<ConditionRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unusable: 'Unusable'
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  initial: 'Opening Stock',
  sale: 'Sale',
  delivery: 'Supplier Delivery',
  adjustment: 'Manual Adjustment',
  damage: 'Damage',
  customer_return: 'Customer Return',
  transfer: 'Transfer',
  loss: 'Loss',
  po_receipt: 'PO Receipt'
}

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partially Received',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  voucher: 'Voucher',
  other: 'Other'
}
