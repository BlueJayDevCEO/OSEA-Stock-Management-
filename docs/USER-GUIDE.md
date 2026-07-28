# OSEA Dive Manager — User Guide

*A guide for dive centre owners, managers, shop staff and equipment technicians. No software or IT knowledge is required.*

---

## 1. Introduction

OSEA Dive Manager is a desktop application that runs on your own computer and keeps track of your dive centre's rental equipment, retail shop, sales, purchase orders and reports in one place. This guide explains every screen and workflow exactly as the application behaves — nothing described here is a "coming soon" feature unless it is explicitly marked as such.

## 2. What OSEA Dive Manager Is

OSEA Dive Manager is an **inventory and point-of-sale tool** for a dive business. It manages:

- Your rental fleet (BCDs, regulators, cylinders, computers, wetsuits, and anything else you rent out)
- Your retail shop (stock, pricing, barcodes)
- Sales at the till
- Purchase orders to suppliers
- Reports on inventory value, utilisation, sales and profit
- Printed labels with QR codes for every asset and product

It is **not** a booking/CRM system, a servicing/scheduling system, an accounting package, or an AI assistant. It does not connect to the internet to function.

## 3. Local and Offline Data Model

Everything you enter is stored in a **single database file** on your own computer — nothing is uploaded anywhere, and no internet connection is required to use the app day-to-day. The file lives at a folder you choose during setup (by default, a folder named "OSEA Dive Manager" inside your Documents folder), in a file called `osea-dive-manager.db`.

Because it's a plain file, you are free to:
- Put it on a NAS or a folder synced by OneDrive/Dropbox/Google Drive if you want an automatic off-site copy
- Copy it to a USB drive to move it to another computer
- Back it up with whatever backup tool you already use

OSEA Software cannot see, access, or recover this file for you — it is entirely in your hands. There is no cloud account, no login, and no subscription check needed to open the app.

**Cloud database connections (PostgreSQL, MySQL, SQL Server, Firebase)** are shown as an option in setup but are **not available in this version** — the screen tells you they arrive in a future v1.1 update. Selecting "Create a local database" is the only way to proceed today.

## 4. Installation and First Launch

Run the installer (`OSEA-Dive-Manager-Setup-<version>.exe` on Windows). You can choose the install location; a desktop shortcut and Start Menu entry are created automatically. No separate database engine, runtime, or account sign-up is needed — everything required is bundled into the installer.

The first time you open OSEA Dive Manager, it detects that it hasn't been set up yet and shows the **Setup Wizard** described below, instead of the normal dashboard.

## 5. Setup Wizard

The wizard has four steps, shown as a progress bar at the top:

**Step 1 — Welcome.** A short summary of what the app does and confirmation that it works fully offline.

**Step 2 — Data Storage.** Choose **"Create a local database"** (marked *Recommended*). A **Choose…** button lets you pick a specific folder — useful if you want your data on a NAS or synced drive. If you don't choose a folder, the app uses a sensible default (see below). The **"Connect your own cloud database"** option is present but cannot be continued with in this version — it explains that cloud adapters ship in v1.1.

**Step 3 — Your Business.** Fields:
- **Business Name** — shown throughout the app and on printed documents. *This field is required*, but note: the wizard does not stop you from clicking through this step with it blank. If you reach the final step without a name, clicking the finish button sends you back here with the message "Please enter your business name."
- **Currency** — a dropdown of nine currencies (Euro, US Dollar, British Pound, Australian Dollar, Thai Baht, Philippine Peso, Indonesian Rupiah, Mexican Peso, Egyptian Pound). This sets the symbol used everywhere in the app.
- **Default VAT / Sales Tax %** — used as the starting VAT rate for new products (0–50%, can be changed per product later).
- **Your Name** — optional; pre-fills the staff name on sales and log entries.

**Step 4 — Finish.** Shows you the exact file path your database will be created at, and a **"Load demo inventory"** checkbox (ticked by default). Leave it ticked to explore the app with a realistic sample dive centre (fleet, shop stock, sales history, purchase orders); untick it to start completely empty. Clicking **"Create & load demo data"** creates the database and takes you straight to the Dashboard.

If you go **Back** and change the data folder after already reaching this screen, note that the app does not warn you if that folder already contains a database file from earlier use — it will simply open the existing file instead of creating a new one, and any business details you enter get saved into that existing file. If you are re-running setup, make sure you really want to point at that folder.

## 6. Understanding the Dashboard

The dashboard is the first screen you see after setup and shows, at a glance:

- **Total Inventory Value** — combined fleet + shop value, broken down as "Fleet €X · Shop €Y"
- **Sales Today** — revenue and transaction count
- **Sales This Month** — revenue and profit
- **Rental Fleet** — total assets and how many are currently with customers
- **Low Stock** — products at or below their minimum stock level (click to jump to the filtered product list)
- **Out of Stock** — products at zero (click to jump to the filtered list)
- **Service Due** — assets due for service within 14 days (click to open the Service Due report)
- **Overdue Rentals** — checked-out assets past their due-back date (click to open the filtered rental list)

Below the cards: a 14-day sales bar chart, a fleet status breakdown (available/checked out/cleaning/damaged/etc. with counts), and a Recent Activity feed of the last 10 sales, rental events and stock movements.

There is no separate "empty state" screen — with zero data every card simply reads 0 / €0.00, and the charts render empty. Nothing errors out.

## 7. Configuring the Business

*Settings → Business* lets you change everything set during setup, plus the **document numbering prefixes**: Asset Number Prefix (default `AST`), SKU Prefix (default `SKU`), Invoice Prefix (default `INV`), and Purchase Order Prefix (default `PO`). New records use "next number" numbering, e.g. `AST-00001`. Changing a prefix only affects records created afterwards — existing numbers are not renumbered.

## 8. Categories, Equipment Types, Brands, and Suppliers

Before adding real inventory, it's worth reviewing *Settings → Categories & Types* and *Settings → Suppliers*, although none of this is strictly required up front — you can also create a brand on the fly while adding an asset or product.

- **Categories** — a category has a *scope*: `rental`, `retail`, or `both`, which controls where it's offered as a choice. The app comes with 14 pre-built categories (BCDs & Wings, Regulators, Cylinders, Exposure Protection, Masks & Snorkels, Fins, Computers & Instruments, Weights, Torches & Cameras, Safety & Signalling, Spares & Consumables, Apparel & Merchandise, Training Materials, Accessories) — you can rename, add to, or remove any of these that aren't linked to existing records.
- **Equipment Types** — a finer classification under a category (e.g. "BCD" and "Wing" both sit under "BCDs & Wings"). 29 are pre-built. Used only for rental assets.
- **Brands** — a flat list, created ad hoc when adding equipment/products or managed centrally. Brand names are de-duplicated automatically.
- **Suppliers** — full contact record (name, contact person, email, phone, website, address, notes). Suppliers can be archived (soft-deleted) once you stop using them — archiving keeps their history on old purchase orders intact.

None of these can be deleted while something (an asset, product, or equipment type) still references them — the app blocks the deletion with a clear message rather than corrupting existing records.

## 9. Adding Rental Equipment

*Rental Equipment → Add equipment.* Required: an **Equipment Type**. Everything else is optional: category (auto-suggested from the type), brand, supplier, model, size, colour, serial number, purchase date/price, replacement value, warranty expiry, condition, notes, service interval (days) and last/next service dates.

Use the **quantity** field to add several identical items at once (1–200) — for example, ten identical regulators. Each unit gets its own unique asset number and QR code automatically; a serial number you type is only applied to the first unit in the batch (leave it blank when batch-creating non-identical serials, and edit each afterwards).

## 10. Understanding Asset Numbers and Serial Numbers

The **asset number** (e.g. `AST-00012`) is generated by OSEA Dive Manager itself and is what the QR code, search, and Equipment Passport are keyed on — it is guaranteed unique. The **serial number** is the manufacturer's own serial, which you type in yourself; it's for your reference and is searchable, but the app does not enforce it to be unique.

## 11. Rental Equipment Status Workflow

Every rental asset has one status at a time:

`Available → Reserved / Checked Out / Inspection / Cleaning / Servicing / Damaged / Lost / Retired`

The asset detail page only ever shows the actions that make sense for its **current** status — for example, a checked-out item offers only *Return*, *Report damage*, and *Mark lost*. Typical flow:

```
Available → Check out → Checked Out → Return → Returned → Inspect/Clean → Available
```

Every transition (and every note you add) is written permanently to that asset's history — nothing is ever deleted, including damage reports and retirements.

## 12. Checking Equipment Out

From the asset's page, click **Check out** (or **Reserve** to hold it without handing it over yet). You'll be asked for:
- **Customer name** (required)
- **Due back date** (optional, but needed for the dashboard's overdue-rental alert to work)
- **Staff member** (optional, pre-filled from your settings if you've entered a default name)
- **Notes** (optional)

The app will not let you check out (or double-book) an item that isn't currently available — attempting it is rejected with an error rather than silently overwriting the existing booking.

## 13. Returning Equipment

Click **Return** on a checked-out item. You can optionally record a **condition rating** (Unchanged, Excellent, Good, Fair, Poor, Unusable), a staff name, and notes. The asset moves to "Returned" status, ready for inspection/cleaning.

## 14. Inspection and Cleaning Workflow

From "Returned" (or from most other statuses), you can send an item to **Inspection** or **Cleaning**, and from either of those back to **Available**, or on to **Servicing** if something needs fixing. Each step is a button click with an optional staff name/notes — there is no separate checklist or form per inspection type.

## 15. Equipment History / Equipment Passport

Every rental asset has a permanent **Equipment Passport** — its full event history, shown as a timeline on the asset's page (tab: *History*). It records every check-out, return, inspection, cleaning, service, damage report, status change, condition change, and manual note, each timestamped with who did it. A second tab, *Service & inspections*, filters this down to just service/inspection/damage events. You can add a free-text note at any time via **Add note** without changing the asset's status.

## 16. Managing Cylinders

Cylinders are rental assets — the "Cylinders" category exists out of the box and there's a "Cylinder" equipment type, so cylinders are added exactly like any other rental item (see Section 9) and go through the same status workflow.

Behind the scenes, the database has extra fields specifically for cylinders — visual inspection date, hydro test date, working pressure, water capacity, current gas fill, O2-clean status, and nitrox compatibility — and the **Data Migration Centre** (Section 33) recognises and imports these correctly when you bring in an existing cylinder register.

**Current limitation:** there is no screen in the day-to-day app to view or edit those cylinder-specific fields once a cylinder exists — the asset detail page shows the same fields as any other rental item (model, size, serial, purchase/service info) and does not expose hydro/visual test dates or pressure rating. If you need to track those dates for cylinders you add manually (rather than importing them), use **Custom Fields** (Section 8/Settings) to add your own "Hydro Test Due", "Visual Inspection Due" etc. fields to rental assets in the meantime.

## 17. Adding Retail Products

*Retail Shop → Add product.* Only the **product name** is required. Everything else is optional: SKU (auto-generated if left blank), barcode, brand, category, supplier, cost price, retail price, VAT rate (defaults to your business default), minimum/maximum stock, shelf location, description, and an opening stock quantity (only shown when creating a new product).

## 18. SKU and Barcode Management

Every product gets an auto-generated **SKU** (e.g. `SKU-00001`) which is what its QR code and Equipment Passport-style history are keyed on. You can also record the manufacturer's **barcode** — at the sales till, either code works interchangeably, so you don't need to relabel goods that already have a barcode.

## 19. Stock Quantities and Stock Movements

A product's stock quantity is never edited directly — it only changes through a recorded **movement**: the opening stock when created, a sale, a purchase-order receipt, or a manual adjustment (delivery, damage, customer return, transfer, or loss), each with its own reference and notes. The full ledger for a product is visible on its detail page, so you can always see exactly why the number is what it is. The app will refuse any movement that would push stock below zero.

**Minimum stock** is what drives the Low Stock alert on the dashboard and the Low Stock report: any product with stock above zero but at or below its minimum is flagged; stock at or below zero is flagged separately as Out of Stock.

## 20. Making a Sale

*Sales → New sale.* Start typing a product name, SKU, or barcode (or scan it with a USB barcode/QR scanner — see Section 26) to search; matching products appear instantly, and scanning an exact barcode/SKU adds it straight to the cart. Adjust quantity and (if needed) the unit price per line; the app will not let you add more than the available stock.

Fill in customer name (optional — defaults to a walk-in sale), staff member, payment method (Cash, Card, Bank Transfer, Voucher, Other) and an optional discount amount. Click **Complete sale** to finalise: this generates an invoice number, decrements stock for every line, and records the sale permanently. The *History* tab lists every past sale, searchable by invoice number, customer, or staff name, with full line-item and profit detail on click.

## 21. Discounts, VAT, and Profit Tracking

Each product's VAT rate is applied per line (VAT is calculated as included in the price you set, not added on top). A single flat **discount** amount can be applied to the whole sale (capped so it can't exceed the subtotal). The receipt totals show Subtotal, Discount, VAT, and Total. Profit for each sale (and for the Profit by Product report) is calculated as the difference between what was charged and each product's cost price, minus any discount.

## 22. Purchase Orders

*Purchase Orders → New purchase order.* Choose a supplier (optional) and add product lines with quantity ordered and unit cost — or use **Add all low-stock items** to pre-fill the order with every product currently at or below its minimum stock for that supplier. A new PO starts as **Draft**; you can delete a draft freely. Move it to **Sent** once you've placed the order with your supplier.

## 23. Partial and Complete Receiving

When stock arrives, open the PO and enter the quantity received for each line. You don't need to receive everything at once — a PO that's had some but not all lines fully received is marked **Partially Received**; once every line has its full ordered quantity received, it automatically becomes **Completed**. Every receipt immediately increases the matching product's stock and updates that product's cost price to the price you just paid, so your margins stay current without a separate step.

## 24. Low-Stock Management

Besides the dashboard's Low Stock card and the Low Stock report, the fastest path from "we're running low" to "it's on order" is the **Add all low-stock items** button when creating a purchase order (Section 22) — pick the supplier and it fills in every under-minimum product they supply.

## 25. Labels and QR Codes

*Labels & QR* generates a printable QR label for any rental asset or retail product — every item gets one automatically the moment it's created, so there's nothing separate to "generate" first. From this page: choose **Rental assets** or **Retail products**, search/select the items you want (or select all), pick a **quantity of copies**, choose a template, and either **Print** or **Export PDF**.

Four label templates are available:

| Template | Sheet | Labels per sheet | Label size |
|---|---|---|---|
| A4 sheet — 24 labels | A4 | 24 (3×8 grid) | 70×37 mm |
| A4 sheet — 12 labels | A4 | 12 (2×6 grid) | 105×49.5 mm |
| Thermal roll — 62×29 mm | Continuous roll | 1 per label | 62×29 mm |
| Thermal roll — 51×25 mm | Continuous roll | 1 per label | 51×25 mm |

You can also print a single item's label directly from its own detail page (an individual **Print label** button on both the rental asset and retail product screens), which jumps straight to Labels & QR with that one item pre-selected.

## 26. Using a Barcode or QR Scanner

OSEA Dive Manager expects a standard **USB "keyboard wedge" scanner** — the kind that types the scanned code followed by Enter, exactly as if someone had typed it and pressed Enter. No special drivers or configuration are needed.

The scanner works **globally, from anywhere in the app** — you don't need to click into a specific box first (except while you're already typing in a text field, where scans are ignored so they don't interfere with what you're writing). Scan an asset number or SKU anywhere else and the app jumps straight to that item's page; scan an unrecognised code and you'll get an on-screen "not found" message rather than the app doing nothing.

## 27. Search and Keyboard Shortcuts

Press **Ctrl/Cmd+K** anywhere to open global search, covering rental assets (number, serial, model, type, brand), products (SKU, barcode, name, brand), sales (invoice number, customer), purchase orders (PO number), and suppliers (name, email). An exact match on an asset number or SKU (such as from a scan) is always ranked first.

## 28. Reports

*Reports* offers eleven report types, each with a date range where relevant (defaulting to the last 30 days), and **Export CSV** / **Print** buttons:

| Report | Shows |
|---|---|
| Inventory Value | Rental fleet and retail stock value, grouped by type/category |
| Rental Utilisation | Fleet size, checkouts, and utilisation % per equipment type |
| Equipment Status | Every asset with its current status, condition, and (if out) who has it |
| Service Due | Assets approaching their next service date |
| Sales | Every sale with totals, VAT, and payment method |
| Profit by Product | Units sold, revenue, cost, profit and margin per product |
| Suppliers | Order counts and received value per supplier |
| Purchase Orders | Every PO with status, ordered vs received value |
| Damage Reports | Every asset damage event logged, with notes |
| Low Stock | Every product at or below its minimum |
| Out of Stock | Every product at zero stock |

## 29. Exporting Data

Every report can be **exported to CSV** (opens cleanly in Excel/Google Sheets, including a byte-order marker so accented characters display correctly) or sent to your printer. Separately, *Settings → Data & Backups* offers a full **JSON export** of every table in the database — useful for your own record-keeping, audits, or migrating to a future system.

## 30. Backups

*Settings → Data & Backups → Back up now* saves a complete snapshot of your database file to any location you choose (a second drive, USB stick, network folder). This is a straight copy of the live database — restoring it brings back everything exactly as it was at backup time. There is no automatic/scheduled backup — running one is a manual action you (or your team) need to remember to do.

## 31. Restoring Data

*Settings → Data & Backups → Restore…* lets you pick a previously-saved backup file. **Restoring replaces all current data with what's in that backup file** — the app is expected to confirm before overwriting, so make sure you're pointing at the right file before confirming.

## 32. Moving Data to Another Computer

Because everything lives in one `osea-dive-manager.db` file, moving to another computer is: install OSEA Dive Manager on the new machine, run setup, then use **Restore** (Section 31) pointed at a backup copied over from the old machine — or simply copy the `.db` file itself into the data folder shown in *Settings → Data & Backups* before first opening the app there. No cloud transfer or account login is involved.

## 33. Data Migration Centre

*Settings → Migration Centre.* This is the tool for bringing in data from your previous spreadsheet or system. The workflow:

1. **Select Files** — opens your computer's normal file picker; you can select several files at once, of mixed formats.
2. Each file (and, for Excel workbooks, **each non-empty sheet inside it**) appears as its own card with a live preview of its column headers and row count.
3. The app **suggests** what kind of data each file/sheet looks like (Retail Products, Rental Assets, Cylinders, Suppliers, or Customers) based on its column headers and file/sheet name — you can override this dropdown if it guessed wrong.
4. **Column mapping** — for each OSEA field (required ones marked with `*`), choose which of your spreadsheet's columns supplies it, or leave it skipped. The app pre-fills sensible guesses automatically; check them before continuing.
5. Click **Check** to validate: you'll see how many rows are valid, how many have errors (with the specific reason per row), and how many look like duplicates of records already in your database.
6. Fix mapping issues and re-check as needed, then confirm the import (choosing whether to skip duplicate rows or import them anyway).
7. You get an **import summary**: how many rows were imported, how many were skipped, and the first error message for any that failed.

## 34. Supported Import Formats

CSV, Excel (`.xlsx` and `.xls`), and JSON. All are read directly from your computer's disk — nothing is uploaded to import your data.

## 35. Importing Multiple Files

You can select several files of different formats in a single pass through **Select Files**; each is inspected, classified, and mapped independently, so you might bring in a CSV of assets and a JSON file of suppliers in the same session.

## 36. Importing Multi-Sheet Excel Workbooks

If an Excel workbook has more than one sheet with data in it, **each non-empty sheet is treated as its own independent source** — shown, classified, and mapped separately (for example, a "Retail Stock" sheet and a "Rental Assets" sheet inside the same workbook become two separate cards). Completely empty sheets are skipped and never shown.

## 37. Classifying Imported Data

The suggested classification is based on evidence from the sheet/file name and its column headers (e.g. a column called "Asset Number" strongly suggests Rental Assets; "Cost Price" and "Retail Price" together suggest Retail Products). You always have the final say via the entity dropdown before mapping columns.

## 38. Column Mapping

Required OSEA fields differ by entity — for example, Retail Products need at minimum a SKU and a name; Rental Assets need at minimum an asset number. Anything not mapped is left blank/default on import (opening stock defaults sensibly rather than being invented).

## 39. Validation Errors

Before anything is written to your database, every row is checked. Rows with a missing required field, or a price/quantity that isn't a valid number, are listed individually with the specific reason — **invalid rows are never silently dropped or auto-corrected**; you see exactly which rows failed and why, and the import is blocked until you've resolved or knowingly accepted them.

## 40. Duplicate Handling

If a row's key value (asset number or SKU) already exists in your database, it's flagged as a duplicate rather than silently creating a second record or silently overwriting the existing one. You choose whether to skip duplicate rows or proceed anyway.

## 41. Confirming an Import

Importing runs as a single all-or-nothing operation per file/sheet: if any row you haven't resolved is still invalid, the whole import for that file is blocked with "Please resolve invalid rows before importing." — nothing partial is written.

## 42. Understanding the Migration Report

After an import completes, you get counts of rows **imported**, **skipped** (duplicates you chose to skip, or previously-invalid rows), and **failed**, plus the first error message if anything failed unexpectedly during the write itself.

## 43. Local Data Privacy

No customer data — stock, sales, rental, or personal customer details — leaves your computer as part of normal use, reporting, backup, or migration. There is no telemetry, analytics, or usage tracking sent anywhere, and no AI/LLM service is called to process your business data.

## 44. Recommended Daily Workflow

- Check the Dashboard for overdue rentals and low/out-of-stock alerts.
- Process check-outs and returns as customers arrive.
- Ring up retail sales as they happen (stock updates itself).
- At day's end, glance at Sales Today and Recent Activity.

## 45. Recommended Weekly Workflow

- Review the Low Stock and Out of Stock reports; raise purchase orders for anything you need to reorder.
- Review the Service Due report and schedule any upcoming equipment servicing.
- Chase up anything sitting in Damaged status.

## 46. Recommended Backup Routine

Since backups are manual (Section 30), pick a regular time — e.g. end of each trading day or week — to run **Back up now** to a second drive or synced folder, so a hardware failure never costs you more than that interval's data.

## 47. Troubleshooting

- **"This identifier (barcode, SKU, or name) already exists in the system."** — you're trying to create or import a record with a code that's already in use; choose a different one or check whether it's a duplicate of something you already have.
- **"This item cannot be removed because it is linked to historical records."** — you tried to delete a category/brand/supplier/equipment type still referenced by existing assets or products; archive it instead, or reassign those records first.
- **"Please resolve invalid rows before importing."** — go back to the Migration Centre's validation step and check/fix the flagged rows.
- **App shows the Setup Wizard again unexpectedly** — this means the app can no longer find its saved configuration; your actual data file is untouched on disk unless you also deleted it, but you will need to point setup at the same data folder to reopen it rather than starting fresh.

## 48. Known Limitations

- No mobile app or web access — this is a Windows/Mac/Linux desktop application only.
- No multi-user network access — the database is a single local file used by one installation at a time.
- No cloud database connection (PostgreSQL/MySQL/SQL Server/Firebase) in this version — shown in setup as arriving in a future update.
- No automatic/scheduled backups — backing up is a manual action.
- No screen to view or edit cylinder-specific fields (hydro/visual test dates, working pressure) after creation — see Section 16.
- Customer records can be created (including via the Migration Centre) but are not yet connected to sales or rental check-outs elsewhere in the app.
- No AI features of any kind.

## 49. Support Information

*[Placeholder — insert your support contact details, website, and/or ticketing link here.]*
