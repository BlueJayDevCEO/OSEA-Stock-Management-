import type { SqlDriver } from './driver'

/**
 * Versioned migrations. Each entry runs once, in order, inside a transaction.
 * The current version is stored in PRAGMA user_version. Future modules
 * (servicing, bookings, CRM…) append migrations here without touching V1 tables.
 */
const MIGRATIONS: string[] = [
  // --- v1: OSEA Dive Manager — Inventory Module ---------------------------
  `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE counters (
    name  TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE categories (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    scope      TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('rental','retail','both')),
    is_system  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE equipment_types (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE brands (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE suppliers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    contact_name TEXT,
    email        TEXT,
    phone        TEXT,
    website      TEXT,
    address      TEXT,
    notes        TEXT,
    archived     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE rental_assets (
    id                    TEXT PRIMARY KEY,
    asset_number          TEXT NOT NULL UNIQUE,
    equipment_type_id     TEXT REFERENCES equipment_types(id) ON DELETE SET NULL,
    category_id           TEXT REFERENCES categories(id) ON DELETE SET NULL,
    brand_id              TEXT REFERENCES brands(id) ON DELETE SET NULL,
    supplier_id           TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    model                 TEXT,
    size                  TEXT,
    colour                TEXT,
    serial_number         TEXT,
    purchase_date         TEXT,
    purchase_price        REAL,
    replacement_value     REAL,
    warranty_expiry       TEXT,
    status                TEXT NOT NULL DEFAULT 'available',
    condition             TEXT NOT NULL DEFAULT 'good',
    notes                 TEXT,
    photo                 TEXT,
    service_interval_days INTEGER,
    last_service_date     TEXT,
    next_service_date     TEXT,
    current_renter        TEXT,
    due_back              TEXT,
    archived              INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );
  CREATE INDEX idx_assets_status ON rental_assets(status);
  CREATE INDEX idx_assets_type   ON rental_assets(equipment_type_id);
  CREATE INDEX idx_assets_number ON rental_assets(asset_number);

  CREATE TABLE rental_events (
    id            TEXT PRIMARY KEY,
    asset_id      TEXT NOT NULL REFERENCES rental_assets(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,
    from_status   TEXT,
    to_status     TEXT,
    customer_name TEXT,
    staff_name    TEXT,
    due_date      TEXT,
    condition     TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE INDEX idx_events_asset ON rental_events(asset_id, created_at DESC);

  CREATE TABLE products (
    id             TEXT PRIMARY KEY,
    sku            TEXT NOT NULL UNIQUE,
    barcode        TEXT,
    name           TEXT NOT NULL,
    brand_id       TEXT REFERENCES brands(id) ON DELETE SET NULL,
    category_id    TEXT REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id    TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    cost_price     REAL NOT NULL DEFAULT 0,
    retail_price   REAL NOT NULL DEFAULT 0,
    vat_rate       REAL NOT NULL DEFAULT 0,
    stock_qty      INTEGER NOT NULL DEFAULT 0,
    min_stock      INTEGER NOT NULL DEFAULT 0,
    max_stock      INTEGER,
    shelf_location TEXT,
    description    TEXT,
    image          TEXT,
    archived       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
  CREATE INDEX idx_products_sku     ON products(sku);
  CREATE INDEX idx_products_barcode ON products(barcode);

  CREATE TABLE stock_movements (
    id            TEXT PRIMARY KEY,
    product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    qty_change    INTEGER NOT NULL,
    qty_after     INTEGER NOT NULL,
    reference     TEXT,
    notes         TEXT,
    staff_name    TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at DESC);
  CREATE INDEX idx_movements_created ON stock_movements(created_at DESC);

  CREATE TABLE purchase_orders (
    id            TEXT PRIMARY KEY,
    po_number     TEXT NOT NULL UNIQUE,
    supplier_id   TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    status        TEXT NOT NULL DEFAULT 'draft',
    order_date    TEXT NOT NULL,
    expected_date TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE purchase_order_lines (
    id           TEXT PRIMARY KEY,
    po_id        TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty_ordered  INTEGER NOT NULL,
    qty_received INTEGER NOT NULL DEFAULT 0,
    unit_cost    REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);

  CREATE TABLE sales (
    id              TEXT PRIMARY KEY,
    invoice_number  TEXT NOT NULL UNIQUE,
    customer_name   TEXT,
    staff_name      TEXT,
    sale_date       TEXT NOT NULL,
    subtotal        REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    vat_amount      REAL NOT NULL DEFAULT 0,
    total           REAL NOT NULL DEFAULT 0,
    payment_method  TEXT NOT NULL DEFAULT 'cash',
    notes           TEXT,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX idx_sales_date ON sales(sale_date DESC);

  CREATE TABLE sale_lines (
    id           TEXT PRIMARY KEY,
    sale_id      TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id   TEXT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku          TEXT NOT NULL,
    qty          INTEGER NOT NULL,
    unit_price   REAL NOT NULL,
    unit_cost    REAL NOT NULL DEFAULT 0,
    vat_rate     REAL NOT NULL DEFAULT 0,
    line_total   REAL NOT NULL
  );
  CREATE INDEX idx_sale_lines_sale ON sale_lines(sale_id);

  CREATE TABLE custom_fields (
    id         TEXT PRIMARY KEY,
    entity     TEXT NOT NULL CHECK (entity IN ('rental_asset','product')),
    name       TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options    TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    UNIQUE (entity, name)
  );

  CREATE TABLE custom_field_values (
    id        TEXT PRIMARY KEY,
    field_id  TEXT NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    record_id TEXT NOT NULL,
    value     TEXT,
    UNIQUE (field_id, record_id)
  );
  CREATE INDEX idx_cfv_record ON custom_field_values(record_id);
  `,
  // --- v2: QA Audit Fixes --------------------------------------------------
  `
  -- Assemblies
  CREATE TABLE assemblies (
    id TEXT PRIMARY KEY,
    asset_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    condition TEXT NOT NULL DEFAULT 'good',
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    updated_by TEXT
  );

  CREATE TABLE assembly_components (
    assembly_id TEXT NOT NULL REFERENCES assemblies(id),
    asset_id TEXT NOT NULL REFERENCES rental_assets(id),
    PRIMARY KEY (assembly_id, asset_id)
  );

  -- Cylinders
  CREATE TABLE cylinders (
    id TEXT PRIMARY KEY REFERENCES rental_assets(id),
    visual_inspection_date TEXT,
    next_visual_due TEXT,
    hydro_test_date TEXT,
    next_hydro_due TEXT,
    valve_service TEXT,
    o2_clean INTEGER NOT NULL DEFAULT 0,
    working_pressure TEXT,
    water_capacity TEXT,
    current_gas TEXT,
    nitrox_compatible INTEGER NOT NULL DEFAULT 0,
    ownership TEXT,
    rental_count INTEGER NOT NULL DEFAULT 0
  );

  -- Customers
  CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    certification_level TEXT,
    bcd_size TEXT,
    suit_size TEXT,
    waiver_status TEXT NOT NULL DEFAULT 'none',
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT,
    updated_by TEXT
  );

  -- Soft Deletes & Audit Trail
  ALTER TABLE sales ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE sales ADD COLUMN created_by TEXT;
  ALTER TABLE sales ADD COLUMN updated_by TEXT;
  ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers(id);

  ALTER TABLE purchase_orders ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE purchase_orders ADD COLUMN created_by TEXT;
  ALTER TABLE purchase_orders ADD COLUMN updated_by TEXT;

  ALTER TABLE rental_events ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE rental_events ADD COLUMN customer_id TEXT REFERENCES customers(id);
  
  ALTER TABLE rental_assets ADD COLUMN created_by TEXT;
  ALTER TABLE rental_assets ADD COLUMN updated_by TEXT;
  
  ALTER TABLE products ADD COLUMN created_by TEXT;
  ALTER TABLE products ADD COLUMN updated_by TEXT;

  ALTER TABLE stock_movements ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  `,
  // --- v3: Commercial Readiness Fixes --------------------------------------
  `
  ALTER TABLE categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE equipment_types ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE brands ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE custom_fields ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
  `
]

export function migrate(db: SqlDriver): void {
  const row = db.get<{ user_version: number }>('PRAGMA user_version')
  const current = row ? Number(row.user_version) : 0
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
}

export const SCHEMA_VERSION = MIGRATIONS.length
