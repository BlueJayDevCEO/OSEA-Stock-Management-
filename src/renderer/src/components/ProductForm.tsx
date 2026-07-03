import { useEffect, useState } from 'react'
import type { Brand, Category, Product, ProductInput, Supplier } from '@shared/types'
import { useApp } from '@renderer/lib/store'
import { Field, Modal } from './ui'

interface Props {
  open: boolean
  product?: Product | null
  onClose: () => void
  onSaved: () => void
}

export function ProductForm({ open, product, onClose, onSaved }: Props): JSX.Element {
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [busy, setBusy] = useState(false)
  const [newBrand, setNewBrand] = useState('')
  const [form, setForm] = useState<ProductInput>({ name: '' })

  useEffect(() => {
    if (!open) return
    void Promise.all([
      window.osea.catalog.listCategories('retail'),
      window.osea.catalog.listBrands(),
      window.osea.catalog.listSuppliers()
    ]).then(([c, b, s]) => {
      setCategories(c)
      setBrands(b)
      setSuppliers(s)
    })
    setNewBrand('')
    setForm(
      product
        ? {
            name: product.name,
            barcode: product.barcode,
            brandId: product.brandId,
            categoryId: product.categoryId,
            supplierId: product.supplierId,
            costPrice: product.costPrice,
            retailPrice: product.retailPrice,
            vatRate: product.vatRate,
            minStock: product.minStock,
            maxStock: product.maxStock,
            shelfLocation: product.shelfLocation,
            description: product.description
          }
        : { name: '', vatRate: settings?.defaultVatRate ?? 20, openingStock: 0 }
    )
  }, [open, product, settings])

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]): void =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async (): Promise<void> => {
    if (!form.name.trim()) {
      toast('error', 'Product name is required.')
      return
    }
    setBusy(true)
    try {
      let brandId = form.brandId ?? null
      if (newBrand.trim()) brandId = (await window.osea.catalog.createBrand(newBrand)).id
      const payload = { ...form, brandId }
      if (product) {
        await window.osea.products.update(product.id, payload)
        toast('success', `${product.sku} updated`)
      } else {
        const created = await window.osea.products.create(payload)
        toast('success', `${created.name} created — SKU ${created.sku}`)
      }
      onSaved()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not save the product.')
    } finally {
      setBusy(false)
    }
  }

  const margin =
    (form.retailPrice ?? 0) > 0 && (form.costPrice ?? 0) > 0
      ? Math.round((((form.retailPrice ?? 0) - (form.costPrice ?? 0)) / (form.retailPrice ?? 1)) * 1000) / 10
      : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.sku}` : 'Add retail product'}
      wide
      footer={
        <>
          {margin !== null && (
            <span className="mr-auto self-center text-xs text-abyss-400">Margin: {margin}%</span>
          )}
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : product ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
        <Field label="Product name *" className="col-span-2">
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Barcode (EAN/UPC)" hint="Scan into this field if you have a scanner">
          <input
            className="input font-mono"
            value={form.barcode ?? ''}
            onChange={(e) => set('barcode', e.target.value || null)}
          />
        </Field>

        <Field label="Category">
          <select
            className="input"
            value={form.categoryId ?? ''}
            onChange={(e) => set('categoryId', e.target.value || null)}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <select
            className="input"
            value={form.brandId ?? ''}
            onChange={(e) => {
              set('brandId', e.target.value || null)
              setNewBrand('')
            }}
          >
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="…or add a new brand">
          <input className="input" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
        </Field>

        <Field label="Cost price">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={form.costPrice ?? ''}
            onChange={(e) => set('costPrice', e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </Field>
        <Field label="Retail price (inc. VAT)">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={form.retailPrice ?? ''}
            onChange={(e) => set('retailPrice', e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </Field>
        <Field label="VAT rate %">
          <input
            className="input"
            type="number"
            min="0"
            max="50"
            step="0.1"
            value={form.vatRate ?? ''}
            onChange={(e) => set('vatRate', e.target.value === '' ? 0 : Number(e.target.value))}
          />
        </Field>

        {!product && (
          <Field label="Opening stock" hint="Recorded as an opening-stock movement">
            <input
              className="input"
              type="number"
              min="0"
              value={form.openingStock ?? 0}
              onChange={(e) => set('openingStock', Number(e.target.value) || 0)}
            />
          </Field>
        )}
        <Field label="Minimum stock" hint="Low-stock alert threshold">
          <input
            className="input"
            type="number"
            min="0"
            value={form.minStock ?? 0}
            onChange={(e) => set('minStock', Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Maximum stock">
          <input
            className="input"
            type="number"
            min="0"
            value={form.maxStock ?? ''}
            onChange={(e) => set('maxStock', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>

        <Field label="Shelf location">
          <input
            className="input"
            value={form.shelfLocation ?? ''}
            onChange={(e) => set('shelfLocation', e.target.value || null)}
            placeholder="e.g. A3"
          />
        </Field>
        <Field label="Supplier" className="col-span-2 max-sm:col-span-1">
          <select
            className="input"
            value={form.supplierId ?? ''}
            onChange={(e) => set('supplierId', e.target.value || null)}
          >
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" className="col-span-3 max-md:col-span-2 max-sm:col-span-1">
          <textarea
            className="input min-h-[64px]"
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value || null)}
          />
        </Field>
      </div>
    </Modal>
  )
}
