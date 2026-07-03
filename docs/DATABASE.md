# Database Schema (v1)

SQLite, one file, WAL mode, foreign keys on. Schema version tracked in `PRAGMA user_version`;
migrations live in `src/main/db/schema.ts`. All primary keys are UUID strings (portable to
any future provider); all timestamps are ISO-8601 strings (UTC).

## Catalog

| Table | Purpose | Key columns |
| --- | --- | --- |
| `categories` | Owner-editable groupings, scoped to `rental`, `retail` or `both` | `name` (unique), `scope`, `is_system` |
| `equipment_types` | Rental asset types (BCD, Regulator, Cylinder…, extendable) | `name` (unique), `category_id` |
| `brands` | Shared by rental assets and products | `name` (unique) |
| `suppliers` | Contact book + purchasing | `name`, `contact_name`, `email`, `phone`, `website`, `address`, `notes`, `archived` |

## Rental inventory

### `rental_assets`
Identity (`asset_number` unique — this is what the QR encodes), classification
(`equipment_type_id`, `category_id`, `brand_id`, `supplier_id`), physical (`model`, `size`,
`colour`, `serial_number`), financial (`purchase_date`, `purchase_price`,
`replacement_value`, `warranty_expiry`), lifecycle (`status`, `condition`, `current_renter`,
`due_back`), servicing (`service_interval_days`, `last_service_date`, `next_service_date`),
plus `notes`, `photo`, `archived`, timestamps.

`status` ∈ available · reserved · checked_out · returned · cleaning · inspection ·
servicing · damaged · lost · retired.

### `rental_events`
Append-only history: `event_type` (created, reserved, checked_out, returned, inspection,
cleaning, service, damage_reported, status_change, condition_change, note), `from_status`,
`to_status`, `customer_name`, `staff_name`, `due_date`, `condition`, `notes`, `created_at`.
This table IS the rental / service / inspection history on the Equipment Passport.

## Retail inventory

### `products`
`sku` (unique, generated), `barcode`, `name`, classification ids, `cost_price`,
`retail_price`, `vat_rate`, `stock_qty`, `min_stock`, `max_stock`, `shelf_location`,
`description`, `image`, `archived`, timestamps.

### `stock_movements`
Append-only ledger. `movement_type` ∈ initial · sale · delivery · adjustment · damage ·
customer_return · transfer · loss · po_receipt. Records `qty_change`, `qty_after`,
`reference` (invoice / PO number), `notes`, `staff_name`. **`products.stock_qty` is only
ever written together with a row here, in one transaction.**

## Purchasing & sales

| Table | Notes |
| --- | --- |
| `purchase_orders` | `po_number` unique, `status` ∈ draft · sent · partial · completed · cancelled |
| `purchase_order_lines` | `qty_ordered`, `qty_received`, `unit_cost`; receiving writes `po_receipt` movements and refreshes product cost price |
| `sales` | `invoice_number` unique, `customer_name` (optional), `staff_name`, `subtotal`, `discount_amount`, `vat_amount` (extracted from VAT-inclusive prices), `total`, `payment_method` |
| `sale_lines` | Snapshot of `product_name`, `sku`, `unit_price`, `unit_cost`, `vat_rate` at time of sale — history survives product edits/deletes; profit is computed from these snapshots |

## Extensibility & system

| Table | Notes |
| --- | --- |
| `custom_fields` | Owner-defined fields per entity (`rental_asset` / `product`), types text · number · date · select (options as JSON) |
| `custom_field_values` | One value per field per record |
| `settings` | Key→JSON (business profile, prefixes, VAT default) |
| `counters` | Named sequences for asset numbers, SKUs, invoices, POs |

## Indexes

Status/type/number on assets; asset+date on events; SKU and barcode on products;
product+date and date on movements; date on sales; FK indexes on line tables.
