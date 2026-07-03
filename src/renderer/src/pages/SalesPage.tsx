import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Receipt, ScanLine, Search, ShoppingCart, Trash2 } from 'lucide-react'
import type { PaymentMethod, Product, Sale } from '@shared/types'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@shared/types'
import { formatDateTime, money } from '@renderer/lib/format'
import { useApp } from '@renderer/lib/store'
import { DataTable, type Column } from '@renderer/components/DataTable'
import { EmptyState, Field, Modal, PageHeader } from '@renderer/components/ui'

interface CartLine {
  product: Product
  qty: number
}

export function SalesPage(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)
  const [tab, setTab] = useState<'new' | 'history'>('new')

  // --- New sale state -------------------------------------------------------
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [staffName, setStaffName] = useState(settings?.staffName ?? '')
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [busy, setBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // --- History state -----------------------------------------------------------
  const [sales, setSales] = useState<Sale[] | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [viewSale, setViewSale] = useState<Sale | null>(null)

  // settings load asynchronously — prefill the staff field once they arrive
  useEffect(() => {
    if (settings?.staffName) setStaffName((s) => s || settings.staffName)
  }, [settings])

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      const list = await window.osea.products.list({ search: query, stockLevel: 'all' })
      if (!cancelled) setSuggestions(list.slice(0, 8))
    }, 100)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query])

  const loadHistory = useCallback(async () => {
    setSales(await window.osea.sales.list({ search: historySearch || undefined }))
  }, [historySearch])

  useEffect(() => {
    if (tab === 'history') void loadHistory()
  }, [tab, loadHistory])

  const addToCart = (product: Product): void => {
    if (product.stockQty <= 0) {
      toast('error', `${product.name} is out of stock.`)
      return
    }
    setCart((c) => {
      const existing = c.find((l) => l.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stockQty) {
          toast('error', `Only ${product.stockQty} of ${product.name} in stock.`)
          return c
        }
        return c.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...c, { product, qty: 1 }]
    })
    setQuery('')
    setSuggestions([])
    searchRef.current?.focus()
  }

  /** Enter in the search box = scan: exact SKU/barcode match adds instantly. */
  const onSearchEnter = async (): Promise<void> => {
    const code = query.trim()
    if (!code) return
    const exact = await window.osea.products.getByCode(code)
    if (exact) {
      addToCart(exact)
    } else if (suggestions.length === 1) {
      addToCart(suggestions[0])
    }
  }

  const setQty = (productId: string, qty: number): void => {
    setCart((c) =>
      qty <= 0
        ? c.filter((l) => l.product.id !== productId)
        : c.map((l) =>
            l.product.id === productId ? { ...l, qty: Math.min(qty, l.product.stockQty) } : l
          )
    )
  }

  const subtotal = useMemo(
    () => cart.reduce((acc, l) => acc + l.product.retailPrice * l.qty, 0),
    [cart]
  )
  const discountNum = Math.min(Math.max(0, Number(discount) || 0), subtotal)
  const total = subtotal - discountNum

  const completeSale = async (): Promise<void> => {
    if (cart.length === 0) return
    setBusy(true)
    try {
      const sale = await window.osea.sales.create({
        customerName: customerName || null,
        staffName: staffName || null,
        discountAmount: discountNum,
        paymentMethod,
        lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty }))
      })
      toast('success', `Sale ${sale.invoiceNumber} complete — ${money(sale.total)}`)
      setCart([])
      setCustomerName('')
      setDiscount('')
      searchRef.current?.focus()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Sale failed.')
    } finally {
      setBusy(false)
    }
  }

  const historyColumns = useMemo<Column<Sale>[]>(
    () => [
      {
        key: 'invoice',
        label: 'Invoice',
        sortValue: (s) => s.invoiceNumber,
        render: (s) => <span className="font-mono text-xs font-semibold">{s.invoiceNumber}</span>
      },
      {
        key: 'date',
        label: 'Date',
        sortValue: (s) => s.saleDate,
        render: (s) => formatDateTime(s.saleDate)
      },
      {
        key: 'customer',
        label: 'Customer',
        sortValue: (s) => s.customerName ?? '',
        render: (s) => s.customerName ?? <span className="text-abyss-400">Walk-in</span>
      },
      {
        key: 'staff',
        label: 'Staff',
        sortValue: (s) => s.staffName ?? '',
        render: (s) => s.staffName ?? '—'
      },
      {
        key: 'items',
        label: 'Items',
        align: 'right',
        sortValue: (s) => s.lines.reduce((a, l) => a + l.qty, 0),
        render: (s) => s.lines.reduce((a, l) => a + l.qty, 0)
      },
      {
        key: 'payment',
        label: 'Payment',
        sortValue: (s) => s.paymentMethod,
        render: (s) => PAYMENT_METHOD_LABELS[s.paymentMethod]
      },
      {
        key: 'profit',
        label: 'Profit',
        align: 'right',
        sortValue: (s) => s.profit ?? 0,
        render: (s) => <span className="text-reef-600 dark:text-reef-300">{money(s.profit ?? 0)}</span>
      },
      {
        key: 'total',
        label: 'Total',
        align: 'right',
        sortValue: (s) => s.total,
        render: (s) => <span className="font-semibold">{money(s.total)}</span>
      }
    ],
    []
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sales"
        actions={
          <div className="flex rounded-lg border border-abyss-200 p-0.5 dark:border-abyss-700">
            {(
              [
                ['new', 'New sale'],
                ['history', 'History']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? 'bg-ocean-600 text-white'
                    : 'text-abyss-500 hover:text-abyss-800 dark:hover:text-abyss-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {tab === 'new' ? (
        <div className="grid grid-cols-5 gap-4 max-lg:grid-cols-1">
          {/* Product picker */}
          <div className="col-span-3 max-lg:col-span-1">
            <div className="card p-4">
              <div className="relative">
                <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-abyss-400" />
                <input
                  ref={searchRef}
                  className="input !pl-9"
                  placeholder="Scan a QR / barcode or search products…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void onSearchEnter()
                    }
                  }}
                  autoFocus
                />
              </div>
              {suggestions.length > 0 && (
                <div className="mt-2 divide-y divide-abyss-100 overflow-hidden rounded-lg border border-abyss-200 dark:divide-abyss-800 dark:border-abyss-700">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-ocean-50 disabled:opacity-50 dark:hover:bg-abyss-800/50"
                      onClick={() => addToCart(p)}
                      disabled={p.stockQty <= 0}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-abyss-400">
                          {p.sku}
                          {p.brandName ? ` · ${p.brandName}` : ''} · {p.stockQty} in stock
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold">{money(p.retailPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() === '' && cart.length === 0 && (
                <div className="py-14 text-center text-sm text-abyss-400">
                  <Search size={28} className="mx-auto mb-3 opacity-40" />
                  Scan an item or start typing to add products to the sale.
                </div>
              )}

              {cart.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-abyss-200 dark:border-abyss-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="table-head px-3.5 py-2">Item</th>
                        <th className="table-head px-2 py-2 text-center">Qty</th>
                        <th className="table-head px-3.5 py-2 text-right">Line</th>
                        <th className="table-head w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l) => (
                        <tr key={l.product.id} className="border-b border-abyss-100 last:border-0 dark:border-abyss-800/50">
                          <td className="px-3.5 py-2.5">
                            <div className="font-medium">{l.product.name}</div>
                            <div className="text-xs text-abyss-400">
                              {l.product.sku} · {money(l.product.retailPrice)} each
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                className="btn-ghost !p-1"
                                onClick={() => setQty(l.product.id, l.qty - 1)}
                                aria-label="Decrease quantity"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="w-7 text-center font-semibold tabular-nums">{l.qty}</span>
                              <button
                                className="btn-ghost !p-1"
                                onClick={() => setQty(l.product.id, l.qty + 1)}
                                aria-label="Increase quantity"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">
                            {money(l.product.retailPrice * l.qty)}
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              className="btn-ghost !p-1 text-red-500"
                              onClick={() => setQty(l.product.id, 0)}
                              aria-label="Remove line"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Checkout panel */}
          <div className="col-span-2 max-lg:col-span-1">
            <div className="card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-abyss-400">
                <ShoppingCart size={15} /> Checkout
              </h3>
              <div className="space-y-4">
                <Field label="Customer (optional)">
                  <input
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in"
                  />
                </Field>
                <Field label="Staff member">
                  <input
                    className="input"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Discount">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field label="Payment method">
                    <select
                      className="input"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="space-y-1.5 border-t border-abyss-200/70 pt-4 text-sm dark:border-abyss-800/60">
                  <div className="flex justify-between text-abyss-500 dark:text-abyss-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{money(subtotal)}</span>
                  </div>
                  {discountNum > 0 && (
                    <div className="flex justify-between text-abyss-500 dark:text-abyss-400">
                      <span>Discount</span>
                      <span className="tabular-nums">−{money(discountNum)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 text-lg font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{money(total)}</span>
                  </div>
                  <p className="text-xs text-abyss-400">VAT included at each product's rate.</p>
                </div>

                <button
                  className="btn-primary w-full !py-3 text-base"
                  disabled={cart.length === 0 || busy}
                  onClick={completeSale}
                >
                  {busy ? 'Recording…' : `Complete sale · ${money(total)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-abyss-400" />
            <input
              className="input !pl-9"
              placeholder="Search invoice, customer, staff…"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
          {sales === null ? null : sales.length === 0 ? (
            <EmptyState
              icon={<Receipt size={40} />}
              title="No sales recorded yet"
              message="Completed sales appear here with full line detail, profit and payment method."
            />
          ) : (
            <DataTable
              columns={historyColumns}
              rows={sales}
              rowKey={(s) => s.id}
              onRowClick={setViewSale}
              emptyMessage="No sales match."
            />
          )}
        </>
      )}

      {/* Sale detail modal */}
      <Modal
        open={viewSale !== null}
        title={viewSale ? `Sale ${viewSale.invoiceNumber}` : ''}
        onClose={() => setViewSale(null)}
        wide
      >
        {viewSale && (
          <div>
            <div className="mb-4 grid grid-cols-4 gap-3 text-sm max-sm:grid-cols-2">
              <div>
                <div className="label">Date</div>
                {formatDateTime(viewSale.saleDate)}
              </div>
              <div>
                <div className="label">Customer</div>
                {viewSale.customerName ?? 'Walk-in'}
              </div>
              <div>
                <div className="label">Staff</div>
                {viewSale.staffName ?? '—'}
              </div>
              <div>
                <div className="label">Payment</div>
                {PAYMENT_METHOD_LABELS[viewSale.paymentMethod]}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-head px-3 py-2">Item</th>
                  <th className="table-head px-3 py-2 text-right">Qty</th>
                  <th className="table-head px-3 py-2 text-right">Unit</th>
                  <th className="table-head px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewSale.lines.map((l) => (
                  <tr key={l.id} className="border-b border-abyss-100 last:border-0 dark:border-abyss-800/50">
                    <td className="px-3 py-2">
                      {l.productName} <span className="text-xs text-abyss-400">({l.sku})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
              <div className="flex justify-between text-abyss-500 dark:text-abyss-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(viewSale.subtotal)}</span>
              </div>
              <div className="flex justify-between text-abyss-500 dark:text-abyss-400">
                <span>Discount</span>
                <span className="tabular-nums">−{money(viewSale.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-abyss-500 dark:text-abyss-400">
                <span>VAT (included)</span>
                <span className="tabular-nums">{money(viewSale.vatAmount)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(viewSale.total)}</span>
              </div>
              <div className="flex justify-between text-reef-600 dark:text-reef-300">
                <span>Profit</span>
                <span className="tabular-nums">{money(viewSale.profit ?? 0)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
