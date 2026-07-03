# User Guide

## First run

The setup wizard asks three things: where your data lives (any folder — it's one database
file you own), your business details (name, currency, VAT), and whether to load the demo
dive centre. You can change every setting later in **Settings**.

## The rental workflow

Every rental asset has an **Equipment Passport** — open it by scanning its QR label, via
search (`Ctrl/Cmd+K`), or from the Rental Equipment list.

```
Scan QR → Passport opens → Check out → Return → Inspect → Clean → Available again
```

The passport always shows exactly the actions that make sense for the current status
(a checked-out BCD offers *Return*, *Report damage*, *Mark lost* — nothing else), and every
step is logged automatically with customer, staff, condition and notes. Nothing to remember,
nothing to write down.

- **Check out / Reserve** needs a customer name; add a due-back date to get overdue alerts
  on the dashboard.
- **Service complete** updates the last-service date and, if the asset has a service
  interval, schedules the next one automatically.
- **Damage / Lost / Retired** keep the asset and its full history — nothing is deleted.

### Adding equipment

*Rental Equipment → Add equipment.* Set the quantity to add a whole batch (e.g. 6 identical
12L cylinders) — each unit gets its own asset number and QR code. New brands can be typed
straight into the form.

## The retail shop

*Retail Shop → Add product.* Every product gets a generated SKU and QR code; add the
manufacturer barcode too and either code works at the till. Set a **minimum stock** to get
low-stock alerts and one-click reordering.

Stock only changes through recorded movements: sales, PO receipts, and manual adjustments
(delivery, damage, customer return, transfer, loss) — each with reference and notes. The
full ledger is on the product page.

## Selling

*Sales → New sale.* Scan items or type to search; quantities, discount and payment method on
one screen. Completing the sale assigns an invoice number, decrements stock, records the
movements and captures profit. *History* shows every sale with line detail.

## Purchase orders

*Purchase Orders → New purchase order.* Pick a supplier and add lines — or press **Add all
low-stock items** to restock everything below minimum in one click. Mark it *Sent*, then
**Receive delivery** when boxes arrive; partial deliveries are fine. Receiving updates stock
and cost prices automatically.

## Labels & QR

*Labels & QR* prints for any selection of assets or products — individually, in bulk, or
re-printed any time. Templates: A4 24-up, A4 12-up, Brother 62×29 mm, Zebra 51×25 mm.
**Print** uses your normal printer dialog; **Export PDF** saves a file. Rows in the Rental
and Retail lists also have a *Print labels* bulk action.

## Reports

Eleven reports, each printable and exportable to CSV: Inventory Value, Rental Utilisation,
Equipment Status, Service Due, Sales, Profit by Product, Suppliers, Purchase Orders, Damage,
Low Stock, Out of Stock. Date-ranged reports default to the last 30 days.

## Search & scanning

`Ctrl/Cmd+K` opens search across everything: asset numbers, serials, SKUs, barcodes, brands,
models, invoices, POs, suppliers. A USB scanner works anywhere in the app — scanning a label
jumps straight to that item.

## Your data

*Settings → Data & Backups*:

- **Back up now** — snapshot the database to any file/drive.
- **Restore** — replace current data from a backup (confirmation required).
- **Export JSON / Import JSON** — a complete, human-readable dump of every table; the
  migration path to a future customer-owned cloud database.

Tip: your data folder can be a NAS or synced folder — the app is a single local file either
way and never needs the internet.

## Customising

*Settings*:

- **Business** — name, currency, VAT default, and the prefixes used for asset numbers,
  SKUs, invoices and POs.
- **Categories & Types** — add/rename/delete categories, equipment types and brands.
- **Suppliers** — full contact book; archive suppliers you no longer use.
- **Custom Fields** — add text/number/date/dropdown fields to assets or products
  (hydro test dates, O2-clean status, DIN/Yoke…) — they appear on every matching record.
