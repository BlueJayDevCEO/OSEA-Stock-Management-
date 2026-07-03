import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package, Plus, Printer, Search } from 'lucide-react'
import type { Brand, Category, Product } from '@shared/types'
import { money } from '@renderer/lib/format'
import { DataTable, type Column } from '@renderer/components/DataTable'
import { StockBadge } from '@renderer/components/StatusBadge'
import { EmptyState, PageHeader, Spinner } from '@renderer/components/ui'
import { ProductForm } from '@renderer/components/ProductForm'

export function ProductListPage(): JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)

  const stockLevel = (params.get('stock') as 'all' | 'low' | 'out' | 'in_stock' | null) ?? 'all'

  const load = useCallback(async () => {
    setProducts(
      await window.osea.products.list({
        search: search || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        stockLevel
      })
    )
  }, [search, categoryId, brandId, stockLevel])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void window.osea.catalog.listCategories('retail').then(setCategories)
    void window.osea.catalog.listBrands().then(setBrands)
  }, [])

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: 'sku',
        label: 'SKU',
        sortValue: (p) => p.sku,
        render: (p) => <span className="font-mono text-xs font-semibold">{p.sku}</span>
      },
      {
        key: 'name',
        label: 'Product',
        sortValue: (p) => p.name,
        render: (p) => (
          <div>
            <div className="font-medium">{p.name}</div>
            {p.brandName && <div className="text-xs text-abyss-400">{p.brandName}</div>}
          </div>
        )
      },
      {
        key: 'category',
        label: 'Category',
        sortValue: (p) => p.categoryName ?? '',
        render: (p) => p.categoryName ?? '—'
      },
      {
        key: 'stock',
        label: 'Stock',
        sortValue: (p) => p.stockQty,
        render: (p) => <StockBadge qty={p.stockQty} min={p.minStock} />
      },
      {
        key: 'location',
        label: 'Shelf',
        sortValue: (p) => p.shelfLocation ?? '',
        render: (p) => p.shelfLocation ?? '—'
      },
      {
        key: 'cost',
        label: 'Cost',
        align: 'right',
        sortValue: (p) => p.costPrice,
        render: (p) => money(p.costPrice)
      },
      {
        key: 'price',
        label: 'Price',
        align: 'right',
        sortValue: (p) => p.retailPrice,
        render: (p) => <span className="font-semibold">{money(p.retailPrice)}</span>
      }
    ],
    []
  )

  const setStockFilter = (value: string): void => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('stock')
    else next.set('stock', value)
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Retail Shop"
        subtitle={products ? `${products.length} products in view` : undefined}
        actions={
          <>
            {selected.size > 0 && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/labels?kind=product&ids=${[...selected].join(',')}`)}
              >
                <Printer size={15} /> Print {selected.size} label{selected.size > 1 ? 's' : ''}
              </button>
            )}
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add product
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-abyss-400" />
          <input
            className="input !pl-9"
            placeholder="Search name, SKU, barcode, brand, shelf…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input !w-44" value={stockLevel} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="all">All stock levels</option>
          <option value="in_stock">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select className="input !w-48" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input !w-40" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {!products ? (
        <Spinner />
      ) : products.length === 0 && !search && stockLevel === 'all' && !categoryId && !brandId ? (
        <EmptyState
          icon={<Package size={40} />}
          title="Stock your shop"
          message="Add masks, fins, spares, apparel — anything you sell. Every product gets a SKU, QR code and complete movement history."
          action={
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add your first product
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={products}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/retail/${p.id}`)}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          emptyMessage="No products match these filters."
        />
      )}

      <ProductForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  )
}
