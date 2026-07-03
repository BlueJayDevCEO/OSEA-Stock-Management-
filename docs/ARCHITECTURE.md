# Architecture

## Overview

```
┌──────────────────────────────  Renderer (React + TS)  ─────────────────────────────┐
│  Pages (Dashboard, Rental, Retail, Sales, POs, Labels, Reports, Settings, Wizard)  │
│  Components (DataTable, forms, badges, modals, search palette, toasts)             │
│  window.osea — the ONLY way the UI touches data                                    │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        │ typed, promise-based IPC (Result<T> envelope)
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│  Preload bridge (src/preload) — contextIsolation on, no Node in the renderer       │
└───────────────────────────────────────┬────────────────────────────────────────────┘
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│  Main process (src/main)                                                           │
│   ipc.ts        channel registry — wraps every repository call in Result<T>        │
│   repositories/ ALL business logic: assets, products, sales, purchaseOrders,       │
│                 catalog, reports, customFields, settings, dataAdmin, demoData      │
│   db/driver.ts  SqlDriver interface + SqliteDriver (better-sqlite3)                │
│   db/schema.ts  versioned migrations (PRAGMA user_version)                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

`src/shared/` holds the domain types (`types.ts`) and the API contract (`api.ts`). They are
imported by all three layers, so a change to the contract is a compile error everywhere at
once.

## The repository / driver split (database independence)

The application never touches a database technology directly:

- **Repositories** contain the business rules (status transitions, stock-integrity, document
  numbering, report queries). They speak SQL through the `SqlDriver` interface only.
- **`SqlDriver`** (`src/main/db/driver.ts`) is five methods: `run`, `get`, `all`, `exec`,
  `transaction`, plus `backupTo`/`close`. V1 ships `SqliteDriver`.

### Adding a cloud provider (v1.1 plan)

1. Implement `PostgresDriver implements SqlDriver` (translate `?` placeholders to `$n`,
   map SQLite date functions — the only dialect-specific SQL is flagged in `schema.ts`
   and `reports.ts`).
2. Add a migration runner for the provider (same `MIGRATIONS` array).
3. Extend the setup wizard's storage step to collect a connection string, and
   `config.json` gains `provider: 'postgres'`.

Nothing in the repositories, IPC surface or renderer changes. The customer owns the cloud
account; OSEA still hosts nothing.

## Invariants the code enforces

- **Stock integrity** — `products.stock_qty` is mutated in exactly one place
  (`applyMovement`), which writes a `stock_movements` row in the same transaction and
  rejects negative stock. Sales and PO receipts go through it.
- **Rental state machine** — `ALLOWED_TRANSITIONS` in `assets.ts` defines the legal status
  graph (available → checked_out → returned → inspection/cleaning → available …). Every
  transition writes a `rental_events` row: the Equipment Passport's history is a side
  effect of using the app, never manual bookkeeping.
- **Document numbers** — invoices, POs, asset numbers and SKUs come from the `counters`
  table inside the same transaction as the insert (no gaps, no duplicates).
- **Result envelope** — every IPC handler returns `{ok:true,data}` or `{ok:false,error}`;
  the preload converts failures into rejected promises so the UI shows real error messages,
  never crashes.

## Future modules

Future modules (servicing, bookings, CRM, training, boats, compressors) each add:

1. New tables via a new entry in `MIGRATIONS` (existing data untouched).
2. A new repository file + `handle()` registrations in `ipc.ts`.
3. A new navigation section and pages in the renderer.

The `rental_events` table already models the service/inspection timeline the servicing
module will extend, and `custom_fields` gives owners extensibility without schema changes.

## Security posture

- `contextIsolation: true`, `nodeIntegration: false`; the renderer sees only `window.osea`.
- CSP restricts scripts to the bundle; external links open in the system browser.
- No telemetry, no network calls. The application is fully functional with no internet.

## Testing

`npm run smoke` boots the real main process headlessly against a throwaway database and
exercises setup, demo seeding, the full rental workflow (including illegal-transition
rejection), sales with stock integrity (including oversell rejection), partial/complete PO
receiving, all 11 reports, exact-code search (the QR path), backup and JSON export.
`--screenshot` captures any route for visual regression checks.
