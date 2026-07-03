import { useEffect, useState } from 'react'
import type {
  Brand,
  Category,
  ConditionRating,
  EquipmentType,
  RentalAsset,
  RentalAssetInput,
  Supplier
} from '@shared/types'
import { CONDITIONS, CONDITION_LABELS } from '@shared/types'
import { useApp } from '@renderer/lib/store'
import { Field, Modal } from './ui'

interface Props {
  open: boolean
  asset?: RentalAsset | null
  onClose: () => void
  onSaved: () => void
}

/** Create / edit a rental asset. Creating supports batches (e.g. 6 identical cylinders). */
export function AssetForm({ open, asset, onClose, onSaved }: Props): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState<RentalAssetInput>({})
  const [quantity, setQuantity] = useState('1')
  const [newBrand, setNewBrand] = useState('')

  useEffect(() => {
    if (!open) return
    void Promise.all([
      window.osea.catalog.listEquipmentTypes(),
      window.osea.catalog.listCategories('rental'),
      window.osea.catalog.listBrands(),
      window.osea.catalog.listSuppliers()
    ]).then(([t, c, b, s]) => {
      setTypes(t)
      setCategories(c)
      setBrands(b)
      setSuppliers(s)
    })
    setQuantity('1')
    setNewBrand('')
    setForm(
      asset
        ? {
            equipmentTypeId: asset.equipmentTypeId,
            categoryId: asset.categoryId,
            brandId: asset.brandId,
            supplierId: asset.supplierId,
            model: asset.model,
            size: asset.size,
            colour: asset.colour,
            serialNumber: asset.serialNumber,
            purchaseDate: asset.purchaseDate,
            purchasePrice: asset.purchasePrice,
            replacementValue: asset.replacementValue,
            warrantyExpiry: asset.warrantyExpiry,
            condition: asset.condition,
            notes: asset.notes,
            serviceIntervalDays: asset.serviceIntervalDays,
            lastServiceDate: asset.lastServiceDate,
            nextServiceDate: asset.nextServiceDate
          }
        : { condition: 'good' }
    )
  }, [open, asset])

  const set = <K extends keyof RentalAssetInput>(key: K, value: RentalAssetInput[K]): void =>
    setForm((f) => ({ ...f, [key]: value }))

  const onTypeChange = (typeId: string): void => {
    const t = types.find((x) => x.id === typeId)
    setForm((f) => ({
      ...f,
      equipmentTypeId: typeId || null,
      // default the category from the equipment type — one less click
      categoryId: f.categoryId ?? t?.categoryId ?? null
    }))
  }

  const save = async (): Promise<void> => {
    if (!form.equipmentTypeId) {
      toast('error', 'Choose an equipment type.')
      return
    }
    setBusy(true)
    try {
      let brandId = form.brandId ?? null
      if (newBrand.trim()) {
        brandId = (await window.osea.catalog.createBrand(newBrand)).id
      }
      const payload = { ...form, brandId }
      if (asset) {
        await window.osea.assets.update(asset.id, payload)
        toast('success', `${asset.assetNumber} updated`)
      } else {
        const qty = Math.max(1, Number(quantity) || 1)
        const created = await window.osea.assets.create(payload, qty)
        toast(
          'success',
          created.length === 1
            ? `Asset ${created[0].assetNumber} created with its own QR code`
            : `${created.length} assets created (${created[0].assetNumber} – ${created[created.length - 1].assetNumber})`
        )
      }
      onSaved()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not save the asset.')
    } finally {
      setBusy(false)
    }
  }

  const num = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? `Edit ${asset.assetNumber}` : 'Add rental equipment'}
      wide
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : asset ? 'Save changes' : 'Add to fleet'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
        <Field label="Equipment type *">
          <select
            className="input"
            value={form.equipmentTypeId ?? ''}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            <option value="">Select…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
        <Field label="Condition">
          <select
            className="input"
            value={form.condition ?? 'good'}
            onChange={(e) => set('condition', e.target.value as ConditionRating)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
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
          <input
            className="input"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="e.g. Scubapro"
          />
        </Field>
        <Field label="Model">
          <input
            className="input"
            value={form.model ?? ''}
            onChange={(e) => set('model', e.target.value || null)}
            placeholder="e.g. Hydros Pro"
          />
        </Field>

        <Field label="Size">
          <input
            className="input"
            value={form.size ?? ''}
            onChange={(e) => set('size', e.target.value || null)}
            placeholder="e.g. M, 12L, 42"
          />
        </Field>
        <Field label="Colour">
          <input
            className="input"
            value={form.colour ?? ''}
            onChange={(e) => set('colour', e.target.value || null)}
          />
        </Field>
        <Field label="Serial number">
          <input
            className="input"
            value={form.serialNumber ?? ''}
            onChange={(e) => set('serialNumber', e.target.value || null)}
          />
        </Field>

        <Field label="Purchase date">
          <input
            className="input"
            type="date"
            value={form.purchaseDate ?? ''}
            onChange={(e) => set('purchaseDate', e.target.value || null)}
          />
        </Field>
        <Field label="Purchase price">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={form.purchasePrice ?? ''}
            onChange={(e) => set('purchasePrice', num(e.target.value))}
          />
        </Field>
        <Field label="Replacement value">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={form.replacementValue ?? ''}
            onChange={(e) => set('replacementValue', num(e.target.value))}
          />
        </Field>

        <Field label="Warranty until">
          <input
            className="input"
            type="date"
            value={form.warrantyExpiry ?? ''}
            onChange={(e) => set('warrantyExpiry', e.target.value || null)}
          />
        </Field>
        <Field label="Supplier">
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
        <Field label="Service interval (days)" hint="e.g. 365 for annual regulator service">
          <input
            className="input"
            type="number"
            min="0"
            value={form.serviceIntervalDays ?? ''}
            onChange={(e) =>
              set('serviceIntervalDays', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Field>

        <Field label="Last service">
          <input
            className="input"
            type="date"
            value={form.lastServiceDate ?? ''}
            onChange={(e) => set('lastServiceDate', e.target.value || null)}
          />
        </Field>
        <Field label="Next service due">
          <input
            className="input"
            type="date"
            value={form.nextServiceDate ?? ''}
            onChange={(e) => set('nextServiceDate', e.target.value || null)}
          />
        </Field>
        {!asset && (
          <Field label="Quantity" hint="Creates identical assets, each with its own asset number & QR">
            <input
              className="input"
              type="number"
              min="1"
              max="200"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        )}

        <Field label="Notes" className="col-span-3 max-md:col-span-2 max-sm:col-span-1">
          <textarea
            className="input min-h-[70px]"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || null)}
          />
        </Field>
      </div>
    </Modal>
  )
}
