# OSEA Dive Manager — Quick Start Guide

*Everything you need to get your dive centre up and running.*

## 1. What OSEA Dive Manager Is

OSEA Dive Manager is inventory, rental, sales and reporting software built specifically for dive centres. It manages your rental fleet, retail shop, sales till, purchase orders, and reports — all in one place.

## 2. A Local, Standalone App

OSEA Dive Manager is a standalone desktop application. It installs and runs entirely on your own computer — it is not a website, and it does not require a subscription server to function.

## 3. Your Data Stays on Your Computer

Every piece of business data you enter — rental assets, products, sales, customers, suppliers — is stored only on the computer you install OSEA Dive Manager on. Nothing is uploaded to OSEA or any other company as part of normal use.

## 4. Where Your Database Lives

All your data lives in a single file named `osea-dive-manager.db`. By default this file is created in a folder called "OSEA Dive Manager" inside your Documents folder, but you can choose any folder you like during setup — including a NAS or a synced drive if you want your own off-site copy.

## 5. First Launch and the Setup Wizard

The first time you open OSEA Dive Manager, a short four-step wizard walks you through:
1. **Welcome** — what the app does.
2. **Data Storage** — confirm (or choose) the folder your database lives in.
3. **Your Business** — your business name, currency, and default VAT/sales tax rate.
4. **Finish** — optionally load a demo dive centre to explore the app, or start empty.

If the folder you choose already has an OSEA Dive Manager database in it, the wizard will tell you and let you either open that existing database as-is, or pick a different folder — it will never quietly overwrite an existing business's settings.

## 6. How to Add Rental Equipment

Go to **Rental Equipment → Add equipment**. Choose an equipment type, fill in whatever details you know (brand, model, size, serial number, purchase price), and save. Use the quantity field to add several identical items at once — each gets its own asset number and QR code automatically.

## 7. How to Add Retail Stock

Go to **Retail Shop → Add product**. Only the product name is required — SKU, barcode, pricing, VAT rate, and minimum stock level can all be filled in as you go. A SKU and QR code are generated automatically.

## 8. How to Use Sales

Go to **Sales → New sale**. Search or scan a product to add it to the cart, set quantity and payment method, and click **Complete sale**. Stock is automatically reduced and an invoice number is generated.

## 9. How to Use Purchase Orders

Go to **Purchase Orders → New purchase order**. Pick a supplier, add the products and quantities you're ordering, and mark it **Sent**. When stock arrives, open the order and record what was received — partial deliveries are fully supported, and stock/cost prices update automatically.

## 10. How to Use Labels and QR Codes

Go to **Labels & QR** to print or export QR labels for any rental asset or retail product — individually or in bulk. Four label sizes are supported, for both standard printers and thermal label printers.

## 11. How to Use the Data Migration Centre

Go to **Settings → Migration Centre** to bring in data from your existing spreadsheets. Click **Select Files**, choose one or more files, and the app will suggest what each one contains (rental assets, retail products, suppliers, etc.). Review the suggested column mapping, check for errors or duplicates, and confirm the import.

## 12. Supported Import Formats

- CSV
- Excel — `.xlsx` and `.xls`
- JSON

You can import several files at once, and an Excel workbook with multiple sheets is handled sheet-by-sheet automatically.

## 13. How to Back Up Your Data

Go to **Settings → Data & Backups → Back up now** and choose where to save the backup file (a USB drive, a second folder, a network location). This saves a complete snapshot of your database.

## 14. How to Restore Data

Go to **Settings → Data & Backups → Restore…** and select a previously-saved backup file. **Restoring replaces your current data with the backup** — make sure you're selecting the right file.

## 15. Recommended Backup Routine

Backups are manual — OSEA Dive Manager does not back up automatically. Pick a regular time (end of each trading day or each week) to run **Back up now**, and keep at least one copy somewhere other than the computer itself (a USB drive or synced folder).

**Daily:** check the Dashboard for overdue rentals and low-stock alerts, process check-outs/returns and sales as they happen.

**Weekly:** review the Low Stock and Service Due reports, and run a backup.

## 16. Known Limitations

- Desktop only — no mobile app.
- Single computer/single database at a time — no multi-user network access in this version.
- No cloud database connection (PostgreSQL/MySQL/SQL Server/Firebase) in this version.
- Backups are manual, not automatic.
- No AI features of any kind.

## 17. Support

*[Placeholder — insert your support contact details, website, and/or ticketing link here.]*
