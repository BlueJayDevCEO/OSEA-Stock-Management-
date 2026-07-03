import type {
  AssetFilters,
  CheckoutInput,
  ConditionRating,
  RentalAsset,
  RentalAssetInput,
  RentalEvent,
  RentalEventType,
  RentalStatus
} from '@shared/types'
import { getDb } from '../db'
import { newId, nextNumber, nowIso } from '../db/ids'
import { getSettings } from './settings'

interface AssetRow {
  id: string
  asset_number: string
  equipment_type_id: string | null
  equipment_type_name: string | null
  category_id: string | null
  category_name: string | null
  brand_id: string | null
  brand_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  model: string | null
  size: string | null
  colour: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price: number | null
  replacement_value: number | null
  warranty_expiry: string | null
  status: RentalStatus
  condition: ConditionRating
  notes: string | null
  photo: string | null
  service_interval_days: number | null
  last_service_date: string | null
  next_service_date: string | null
  current_renter: string | null
  due_back: string | null
  archived: number
  created_at: string
  updated_at: string
}

const BASE_SELECT = `
  SELECT a.*,
         t.name AS equipment_type_name,
         c.name AS category_name,
         b.name AS brand_name,
         s.name AS supplier_name
  FROM rental_assets a
  LEFT JOIN equipment_types t ON t.id = a.equipment_type_id
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN suppliers s ON s.id = a.supplier_id
`

function mapAsset(r: AssetRow): RentalAsset {
  return {
    id: r.id,
    assetNumber: r.asset_number,
    equipmentTypeId: r.equipment_type_id,
    equipmentTypeName: r.equipment_type_name,
    categoryId: r.category_id,
    categoryName: r.category_name,
    brandId: r.brand_id,
    brandName: r.brand_name,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    model: r.model,
    size: r.size,
    colour: r.colour,
    serialNumber: r.serial_number,
    purchaseDate: r.purchase_date,
    purchasePrice: r.purchase_price,
    replacementValue: r.replacement_value,
    warrantyExpiry: r.warranty_expiry,
    status: r.status,
    condition: r.condition,
    notes: r.notes,
    photo: r.photo,
    serviceIntervalDays: r.service_interval_days,
    lastServiceDate: r.last_service_date,
    nextServiceDate: r.next_service_date,
    currentRenter: r.current_renter,
    dueBack: r.due_back,
    archived: r.archived === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export function listAssets(filters: AssetFilters = {}): RentalAsset[] {
  const db = getDb()
  const where: string[] = []
  const params: unknown[] = []

  if (!filters.includeArchived) where.push('a.archived = 0')
  if (filters.status && filters.status !== 'all') {
    where.push('a.status = ?')
    params.push(filters.status)
  }
  if (filters.categoryId) {
    where.push('a.category_id = ?')
    params.push(filters.categoryId)
  }
  if (filters.equipmentTypeId) {
    where.push('a.equipment_type_id = ?')
    params.push(filters.equipmentTypeId)
  }
  if (filters.brandId) {
    where.push('a.brand_id = ?')
    params.push(filters.brandId)
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`
    where.push(
      `(a.asset_number LIKE ? OR a.model LIKE ? OR a.serial_number LIKE ? OR a.size LIKE ?
        OR t.name LIKE ? OR b.name LIKE ? OR c.name LIKE ?)`
    )
    params.push(q, q, q, q, q, q, q)
  }

  const limit = filters.limit ?? 1000
  const page = filters.page ?? 1
  const offset = (page - 1) * limit
  params.push(limit, offset)

  const sql = `${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.asset_number LIMIT ? OFFSET ?`
  return db.all<AssetRow>(sql, params).map(mapAsset)
}

export function getAsset(id: string): RentalAsset | null {
  const db = getDb()
  const row = db.get<AssetRow>(`${BASE_SELECT} WHERE a.id = ?`, [id])
  return row ? mapAsset(row) : null
}

export function getAssetByNumber(assetNumber: string): RentalAsset | null {
  const db = getDb()
  const row = db.get<AssetRow>(`${BASE_SELECT} WHERE a.asset_number = ? COLLATE NOCASE`, [assetNumber])
  return row ? mapAsset(row) : null
}

export function createAsset(input: RentalAssetInput, quantity = 1): RentalAsset[] {
  const db = getDb()
  const settings = getSettings()
  const count = Math.max(1, Math.min(200, Math.floor(quantity)))
  const created: string[] = []

  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const id = newId()
      const ts = nowIso()
      const assetNumber = input.assetNumber?.trim() || nextNumber(db, 'asset', settings.assetPrefix)
      db.run(
        `INSERT INTO rental_assets (
           id, asset_number, equipment_type_id, category_id, brand_id, supplier_id,
           model, size, colour, serial_number, purchase_date, purchase_price,
           replacement_value, warranty_expiry, status, condition, notes, photo,
           service_interval_days, last_service_date, next_service_date,
           current_renter, due_back, archived, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
        [
          id,
          assetNumber,
          input.equipmentTypeId ?? null,
          input.categoryId ?? null,
          input.brandId ?? null,
          input.supplierId ?? null,
          input.model ?? null,
          input.size ?? null,
          input.colour ?? null,
          // serial numbers are unique per unit — only apply to the first of a batch
          i === 0 ? (input.serialNumber ?? null) : null,
          input.purchaseDate ?? null,
          input.purchasePrice ?? null,
          input.replacementValue ?? null,
          input.warrantyExpiry ?? null,
          input.condition ?? 'good',
          input.notes ?? null,
          input.photo ?? null,
          input.serviceIntervalDays ?? null,
          input.lastServiceDate ?? null,
          input.nextServiceDate ?? null,
          ts,
          ts
        ]
      )
      insertEvent(id, 'created', null, 'available', { notes: 'Asset added to rental inventory' })
      created.push(id)
    }
  })

  return created.map((id) => getAsset(id)!)
}

export function updateAsset(id: string, input: RentalAssetInput): RentalAsset {
  const db = getDb()
  const existing = getAsset(id)
  if (!existing) throw new Error('Asset not found.')

  db.run(
    `UPDATE rental_assets SET
       equipment_type_id = ?, category_id = ?, brand_id = ?, supplier_id = ?,
       model = ?, size = ?, colour = ?, serial_number = ?, purchase_date = ?,
       purchase_price = ?, replacement_value = ?, warranty_expiry = ?,
       condition = ?, notes = ?, photo = ?, service_interval_days = ?,
       last_service_date = ?, next_service_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.equipmentTypeId ?? null,
      input.categoryId ?? null,
      input.brandId ?? null,
      input.supplierId ?? null,
      input.model ?? null,
      input.size ?? null,
      input.colour ?? null,
      input.serialNumber ?? null,
      input.purchaseDate ?? null,
      input.purchasePrice ?? null,
      input.replacementValue ?? null,
      input.warrantyExpiry ?? null,
      input.condition ?? existing.condition,
      input.notes ?? null,
      input.photo ?? existing.photo,
      input.serviceIntervalDays ?? null,
      input.lastServiceDate ?? null,
      input.nextServiceDate ?? null,
      nowIso(),
      id
    ]
  )
  if (input.condition && input.condition !== existing.condition) {
    insertEvent(id, 'condition_change', existing.status, existing.status, {
      condition: input.condition,
      notes: `Condition changed from ${existing.condition} to ${input.condition}`
    })
  }
  return getAsset(id)!
}

export function setAssetArchived(id: string, archived: boolean): void {
  getDb().run('UPDATE rental_assets SET archived = ?, updated_at = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowIso(),
    id
  ])
}

// ---------------------------------------------------------------------------
// Workflow — every transition is validated and logged automatically.
// Scan QR → Passport → Assign → Check Out → Return → Inspect → Clean → Available
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  available: ['reserved', 'checked_out', 'inspection', 'cleaning', 'servicing', 'damaged', 'lost', 'retired'],
  reserved: ['checked_out', 'available', 'damaged', 'lost'],
  checked_out: ['returned', 'damaged', 'lost'],
  returned: ['inspection', 'cleaning', 'available', 'servicing', 'damaged'],
  cleaning: ['available', 'inspection', 'servicing', 'damaged'],
  inspection: ['available', 'cleaning', 'servicing', 'damaged', 'retired'],
  servicing: ['available', 'inspection', 'damaged', 'retired'],
  damaged: ['servicing', 'inspection', 'available', 'retired', 'lost'],
  lost: ['available', 'retired'],
  retired: ['available']
}

interface EventExtra {
  customerName?: string | null
  staffName?: string | null
  dueDate?: string | null
  condition?: ConditionRating | null
  notes?: string | null
}

function insertEvent(
  assetId: string,
  eventType: RentalEventType,
  fromStatus: RentalStatus | null,
  toStatus: RentalStatus | null,
  extra: EventExtra = {}
): void {
  const db = getDb()
  db.run(
    `INSERT INTO rental_events (id, asset_id, event_type, from_status, to_status, customer_name, staff_name, due_date, condition, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      assetId,
      eventType,
      fromStatus,
      toStatus,
      extra.customerName ?? null,
      extra.staffName ?? null,
      extra.dueDate ?? null,
      extra.condition ?? null,
      extra.notes ?? null,
      nowIso()
    ]
  )
}

function transition(
  id: string,
  toStatus: RentalStatus,
  eventType: RentalEventType,
  extra: EventExtra = {}
): RentalAsset {
  const db = getDb()
  const asset = getAsset(id)
  if (!asset) throw new Error('Asset not found.')
  if (!ALLOWED_TRANSITIONS[asset.status].includes(toStatus)) {
    throw new Error(
      `Cannot move this asset from "${asset.status.replace('_', ' ')}" to "${toStatus.replace('_', ' ')}".`
    )
  }

  db.transaction(() => {
    const renter =
      toStatus === 'checked_out' || toStatus === 'reserved'
        ? (extra.customerName ?? asset.currentRenter)
        : null
    const dueBack = toStatus === 'checked_out' || toStatus === 'reserved' ? (extra.dueDate ?? null) : null

    db.run(
      `UPDATE rental_assets SET status = ?, current_renter = ?, due_back = ?,
        condition = COALESCE(?, condition),
        last_service_date = CASE WHEN ? = 'service' THEN ? ELSE last_service_date END,
        next_service_date = CASE
          WHEN ? = 'service' AND service_interval_days IS NOT NULL
          THEN date(?, '+' || service_interval_days || ' days')
          ELSE next_service_date END,
        updated_at = ?
       WHERE id = ?`,
      [
        toStatus,
        renter,
        dueBack,
        extra.condition ?? null,
        eventType,
        nowIso().slice(0, 10),
        eventType,
        nowIso().slice(0, 10),
        nowIso(),
        id
      ]
    )
    insertEvent(id, eventType, asset.status, toStatus, extra)
  })

  return getAsset(id)!
}

export function checkOutAsset(id: string, input: CheckoutInput): RentalAsset {
  if (!input.customerName || !input.customerName.trim())
    throw new Error('A customer name is required to check out equipment.')
  return transition(id, 'checked_out', 'checked_out', {
    customerName: input.customerName.trim(),
    staffName: input.staffName ?? null,
    dueDate: input.dueBack ?? null,
    notes: input.notes ?? null
  })
}

export function reserveAsset(id: string, input: CheckoutInput): RentalAsset {
  if (!input.customerName || !input.customerName.trim())
    throw new Error('A customer name is required for a reservation.')
  return transition(id, 'reserved', 'reserved', {
    customerName: input.customerName.trim(),
    staffName: input.staffName ?? null,
    dueDate: input.dueBack ?? null,
    notes: input.notes ?? null
  })
}

export function returnAsset(id: string, extra: EventExtra = {}): RentalAsset {
  const asset = getAsset(id)
  return transition(id, 'returned', 'returned', {
    ...extra,
    customerName: extra.customerName ?? asset?.currentRenter ?? null
  })
}

export function setAssetStatus(
  id: string,
  toStatus: RentalStatus,
  extra: EventExtra = {}
): RentalAsset {
  const eventType: RentalEventType =
    toStatus === 'inspection'
      ? 'inspection'
      : toStatus === 'cleaning'
        ? 'cleaning'
        : toStatus === 'servicing'
          ? 'service'
          : toStatus === 'damaged'
            ? 'damage_reported'
            : 'status_change'
  return transition(id, toStatus, eventType, extra)
}

export function completeService(id: string, extra: EventExtra = {}): RentalAsset {
  // "service" event on the way back to available updates service dates
  return transition(id, 'available', 'service', {
    ...extra,
    notes: extra.notes ?? 'Service completed'
  })
}

export function addAssetNote(id: string, notes: string, staffName?: string | null): void {
  const asset = getAsset(id)
  if (!asset) throw new Error('Asset not found.')
  insertEvent(id, 'note', asset.status, asset.status, { notes, staffName: staffName ?? null })
}

export function listAssetEvents(assetId: string, limit = 200): RentalEvent[] {
  const db = getDb()
  const rows = db.all<{
    id: string
    asset_id: string
    event_type: RentalEventType
    from_status: RentalStatus | null
    to_status: RentalStatus | null
    customer_name: string | null
    staff_name: string | null
    due_date: string | null
    condition: ConditionRating | null
    notes: string | null
    created_at: string
  }>(
    'SELECT * FROM rental_events WHERE asset_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
    [assetId, limit]
  )
  return rows.map((r) => ({
    id: r.id,
    assetId: r.asset_id,
    eventType: r.event_type,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    customerName: r.customer_name,
    staffName: r.staff_name,
    dueDate: r.due_date,
    condition: r.condition,
    notes: r.notes,
    createdAt: r.created_at
  }))
}
