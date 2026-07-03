import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Database,
  DownloadCloud,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react'
import type {
  Brand,
  BusinessSettings,
  Category,
  CategoryScope,
  CustomFieldDef,
  CustomFieldEntity,
  CustomFieldType,
  EquipmentType,
  Supplier
} from '@shared/types'
import { useApp } from '@renderer/lib/store'
import { ConfirmDialog, Field, Modal, PageHeader } from '@renderer/components/ui'

type Tab = 'business' | 'catalog' | 'fields' | 'suppliers' | 'data' | 'developer'

export function SettingsPage(): JSX.Element {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab | null) ?? 'business')

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" />
      <div className="mb-5 flex gap-1.5 border-b border-abyss-200/70 dark:border-abyss-800/60">
        {(
          [
            ['business', 'Business'],
            ['catalog', 'Categories & Types'],
            ['suppliers', 'Suppliers'],
            ['fields', 'Custom Fields'],
            ['data', 'Data & Backups']
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === key
                ? 'border-ocean-500 text-ocean-700 dark:text-ocean-300'
                : 'border-transparent text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setTab('developer' as Tab)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${
            tab === 'developer'
              ? 'border-orange-500 text-orange-700 dark:text-orange-300'
              : 'border-transparent text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200'
          }`}
        >
          Developer Tools
        </button>
      </div>

      {tab === 'business' && <BusinessTab />}
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'fields' && <FieldsTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'developer' && <DeveloperTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function DeveloperTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const [promptModalOpen, setPromptModalOpen] = useState(false)

  const showLastPrompt = async () => {
    try {
      const text = await window.osea.app.getLastPrompt()
      setLastPrompt(text)
      setPromptModalOpen(true)
    } catch (err) {
      toast('error', 'Failed to load last prompt.')
    }
  }

  const generateData = async (preset: 'small' | 'medium' | 'large'): Promise<void> => {
    if (!confirm(`Warning: This will generate a massive amount of data and save a demo database. Proceed with '${preset}' preset?`)) return
    setBusy(true)
    try {
      const result = await window.osea.data.generateTestDataset(preset)
      toast('success', `Test dataset generated! Saved demo database to ${result.path}`)
      window.setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const runValidation = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.osea.data.runValidationSuite()
      toast('success', 'Validation Suite Passed! Check terminal for details.')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Validation failed.')
    } finally {
      setBusy(false)
    }
  }

  const exportDemo = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.osea.data.exportDemoDatabase()
      toast('success', `Demo exported to ${result.path}`)
      await window.osea.app.showInFolder(result.path)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="card p-5 border-orange-500/30">
        <h3 className="font-semibold text-orange-600 dark:text-orange-400">Test Dataset Generator</h3>
        <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
          Generate realistic Dive Centre data presets. Will generate Customers, Retail Products, Rental Assets, Cylinders, Assemblies, Events, and Sales.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => generateData('small')} disabled={busy}>Small Shop</button>
          <button className="btn-secondary text-sm" onClick={() => generateData('medium')} disabled={busy}>Medium Centre</button>
          <button className="btn-secondary text-sm" onClick={() => generateData('large')} disabled={busy}>Large Resort</button>
        </div>
      </div>
      <div className="card p-5 border-orange-500/30">
        <h3 className="font-semibold text-orange-600 dark:text-orange-400">Demo Export</h3>
        <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
          Export the active database to SQLite, CSV, and JSON, including a README.
        </p>
        <button className="btn-primary text-sm" onClick={exportDemo} disabled={busy}>Export Demo Database</button>
      </div>
      <div className="card p-5 border-orange-500/30">
        <h3 className="font-semibold text-orange-600 dark:text-orange-400">Validation Suite</h3>
        <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
          Run automated migrations, repository tests, backup tests, and pagination performance profiling.
        </p>
        <button className="btn-secondary text-sm" onClick={runValidation} disabled={busy}>Run Validation Suite</button>
      </div>
      <div className="card p-5 border-orange-500/30">
        <h3 className="font-semibold text-orange-600 dark:text-orange-400">System Workflows</h3>
        <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
          View the most recent developer/system prompt used in the application workflow.
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={showLastPrompt}>Last Prompt</button>
          <button className="btn-secondary text-sm" onClick={() => window.osea.app.openUserManual()}>User Manual</button>
        </div>
      </div>

      {promptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-[700px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-surface-card">
            <div className="flex items-center justify-between border-b border-abyss-200 px-5 py-4 dark:border-abyss-800">
              <h3 className="text-lg font-semibold text-abyss-900 dark:text-abyss-100">Last System Prompt</h3>
              <button
                onClick={() => setPromptModalOpen(false)}
                className="rounded-full p-1 hover:bg-abyss-100 dark:hover:bg-abyss-800"
              >
                <X size={20} className="text-abyss-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-abyss-800 dark:text-abyss-200 whitespace-pre-wrap">
              {lastPrompt || 'No saved prompt yet.'}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-abyss-200 p-4 dark:border-abyss-800">
              <button
                className="btn-ghost"
                onClick={() => setPromptModalOpen(false)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  navigator.clipboard.writeText(lastPrompt || 'No saved prompt yet.')
                  toast('success', 'Copied to clipboard!')
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function BusinessTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const setSettings = useApp((s) => s.setSettings)
  const [form, setForm] = useState<BusinessSettings | null>(null)

  useEffect(() => {
    void window.osea.settings.get().then(setForm)
  }, [])

  if (!form) return <></>

  const set = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]): void =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const save = async (): Promise<void> => {
    const updated = await window.osea.settings.update(form)
    setSettings(updated)
    toast('success', 'Business settings saved')
  }

  return (
    <div className="card max-w-3xl p-6">
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Field label="Business name" className="col-span-2 max-sm:col-span-1">
          <input className="input" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
        </Field>
        <Field label="Currency symbol">
          <input className="input" value={form.currencySymbol} onChange={(e) => set('currencySymbol', e.target.value)} />
        </Field>
        <Field label="Default VAT %">
          <input
            className="input"
            type="number"
            min="0"
            max="50"
            value={form.defaultVatRate}
            onChange={(e) => set('defaultVatRate', Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Default staff name">
          <input className="input" value={form.staffName} onChange={(e) => set('staffName', e.target.value)} />
        </Field>
        <div />
        <Field label="Asset number prefix" hint="New rental assets: PREFIX-00001">
          <input className="input font-mono" value={form.assetPrefix} onChange={(e) => set('assetPrefix', e.target.value.toUpperCase())} />
        </Field>
        <Field label="SKU prefix">
          <input className="input font-mono" value={form.skuPrefix} onChange={(e) => set('skuPrefix', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Invoice prefix">
          <input className="input font-mono" value={form.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Purchase order prefix">
          <input className="input font-mono" value={form.poPrefix} onChange={(e) => set('poPrefix', e.target.value.toUpperCase())} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="btn-primary" onClick={save}>
          <Save size={15} /> Save settings
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CatalogTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [categories, setCategories] = useState<Category[]>([])
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [newCat, setNewCat] = useState('')
  const [newCatScope, setNewCatScope] = useState<CategoryScope>('both')
  const [newType, setNewType] = useState('')
  const [newTypeCat, setNewTypeCat] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ kind: string; id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    const [c, t, b] = await Promise.all([
      window.osea.catalog.listCategories('all'),
      window.osea.catalog.listEquipmentTypes(),
      window.osea.catalog.listBrands()
    ])
    setCategories(c)
    setTypes(t)
    setBrands(b)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const guard = async (fn: () => Promise<unknown>, success: string): Promise<void> => {
    try {
      await fn()
      toast('success', success)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Operation failed.')
    }
  }

  const doDelete = async (): Promise<void> => {
    if (!confirmDelete) return
    const { kind, id, name } = confirmDelete
    setConfirmDelete(null)
    if (kind === 'category') await guard(() => window.osea.catalog.deleteCategory(id), `Deleted "${name}"`)
    if (kind === 'type') await guard(() => window.osea.catalog.deleteEquipmentType(id), `Deleted "${name}"`)
    if (kind === 'brand') await guard(() => window.osea.catalog.deleteBrand(id), `Deleted "${name}"`)
  }

  return (
    <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
      {/* Categories */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-abyss-400">Categories</h3>
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <select
            className="input !w-28"
            value={newCatScope}
            onChange={(e) => setNewCatScope(e.target.value as CategoryScope)}
            aria-label="Category scope"
          >
            <option value="both">Both</option>
            <option value="rental">Rental</option>
            <option value="retail">Retail</option>
          </select>
          <button
            className="btn-primary !px-3"
            aria-label="Add category"
            onClick={() =>
              newCat.trim() &&
              guard(async () => {
                await window.osea.catalog.createCategory(newCat, newCatScope)
                setNewCat('')
              }, 'Category added')
            }
          >
            <Plus size={15} />
          </button>
        </div>
        <ul className="max-h-[46vh] space-y-1 overflow-y-auto">
          {categories.map((c) => (
            <li key={c.id} className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-abyss-50 dark:hover:bg-abyss-800/50">
              <span>
                {c.name}
                <span className="ml-2 text-xs text-abyss-400">{c.scope}</span>
              </span>
              <button
                className="text-abyss-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                onClick={() => setConfirmDelete({ kind: 'category', id: c.id, name: c.name })}
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Equipment types */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-abyss-400">Equipment types</h3>
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="New type…" value={newType} onChange={(e) => setNewType(e.target.value)} />
          <select
            className="input !w-36"
            value={newTypeCat}
            onChange={(e) => setNewTypeCat(e.target.value)}
            aria-label="Type category"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary !px-3"
            aria-label="Add equipment type"
            onClick={() =>
              newType.trim() &&
              guard(async () => {
                await window.osea.catalog.createEquipmentType(newType, newTypeCat || null)
                setNewType('')
              }, 'Equipment type added')
            }
          >
            <Plus size={15} />
          </button>
        </div>
        <ul className="max-h-[46vh] space-y-1 overflow-y-auto">
          {types.map((t) => (
            <li key={t.id} className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-abyss-50 dark:hover:bg-abyss-800/50">
              <span>
                {t.name}
                {t.categoryName && <span className="ml-2 text-xs text-abyss-400">{t.categoryName}</span>}
              </span>
              <button
                className="text-abyss-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                onClick={() => setConfirmDelete({ kind: 'type', id: t.id, name: t.name })}
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Brands */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-abyss-400">Brands</h3>
        <div className="mb-3 flex gap-2">
          <input className="input" placeholder="New brand…" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
          <button
            className="btn-primary !px-3"
            aria-label="Add brand"
            onClick={() =>
              newBrand.trim() &&
              guard(async () => {
                await window.osea.catalog.createBrand(newBrand)
                setNewBrand('')
              }, 'Brand added')
            }
          >
            <Plus size={15} />
          </button>
        </div>
        <ul className="max-h-[46vh] space-y-1 overflow-y-auto">
          {brands.map((b) => (
            <li key={b.id} className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-abyss-50 dark:hover:bg-abyss-800/50">
              {b.name}
              <button
                className="text-abyss-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                onClick={() => setConfirmDelete({ kind: 'brand', id: b.id, name: b.name })}
                aria-label={`Delete ${b.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Delete "${confirmDelete?.name}"?`}
        message="This only works if nothing is using it — items keep their history either way."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function SuppliersTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', website: '', address: '', notes: '' })

  const load = useCallback(async () => {
    setSuppliers(await window.osea.catalog.listSuppliers(true))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (s?: Supplier): void => {
    setEditing(s ?? null)
    setForm({
      name: s?.name ?? '',
      contactName: s?.contactName ?? '',
      email: s?.email ?? '',
      phone: s?.phone ?? '',
      website: s?.website ?? '',
      address: s?.address ?? '',
      notes: s?.notes ?? ''
    })
    setFormOpen(true)
  }

  const save = async (): Promise<void> => {
    try {
      if (editing) {
        await window.osea.catalog.updateSupplier(editing.id, form)
        toast('success', `${form.name} updated`)
      } else {
        await window.osea.catalog.createSupplier(form)
        toast('success', `${form.name} added`)
      }
      setFormOpen(false)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not save the supplier.')
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => openForm()}>
          <Plus size={15} /> Add supplier
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {suppliers.map((s) => (
          <div key={s.id} className={`card p-5 ${s.archived ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">{s.name}</h3>
              <div className="flex gap-1">
                <button className="btn-ghost !p-1.5 text-xs" onClick={() => openForm(s)}>
                  Edit
                </button>
                <button
                  className="btn-ghost !p-1.5 text-xs"
                  onClick={async () => {
                    await window.osea.catalog.setSupplierArchived(s.id, !s.archived)
                    await load()
                  }}
                >
                  {s.archived ? 'Restore' : 'Archive'}
                </button>
              </div>
            </div>
            <dl className="mt-2 space-y-1 text-sm text-abyss-500 dark:text-abyss-400">
              {s.contactName && <dd>{s.contactName}</dd>}
              {s.email && <dd>{s.email}</dd>}
              {s.phone && <dd>{s.phone}</dd>}
              {s.address && <dd className="text-xs">{s.address}</dd>}
              {s.notes && <dd className="text-xs italic">{s.notes}</dd>}
            </dl>
          </div>
        ))}
        {suppliers.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-abyss-400">
            No suppliers yet — add the distributors you buy from.
          </p>
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? `Edit ${editing.name}` : 'Add supplier'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={!form.name.trim()}>
              {editing ? 'Save changes' : 'Add supplier'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Name *" className="col-span-2 max-sm:col-span-1">
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          </Field>
          <Field label="Contact person">
            <input className="input" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Website">
            <input className="input" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          </Field>
          <Field label="Address" className="col-span-2 max-sm:col-span-1">
            <input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="Notes" className="col-span-2 max-sm:col-span-1">
            <textarea className="input min-h-[56px]" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------

function FieldsTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [fields, setFields] = useState<CustomFieldDef[]>([])
  const [entity, setEntity] = useState<CustomFieldEntity>('rental_asset')
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [options, setOptions] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFields(await window.osea.custom.list())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (): Promise<void> => {
    try {
      await window.osea.custom.create(
        entity,
        name,
        fieldType,
        fieldType === 'select' ? options.split(',').map((o) => o.trim()).filter(Boolean) : []
      )
      toast('success', `Custom field "${name}" added`)
      setName('')
      setOptions('')
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not create the field.')
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="card mb-4 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-abyss-400">Add a custom field</h3>
        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          <Field label="Applies to">
            <select className="input" value={entity} onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}>
              <option value="rental_asset">Rental assets</option>
              <option value="product">Retail products</option>
            </select>
          </Field>
          <Field label="Field name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hydro test date" />
          </Field>
          <Field label="Type">
            <select className="input" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Dropdown</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button className="btn-primary w-full" onClick={create} disabled={!name.trim()}>
              <Plus size={15} /> Add
            </button>
          </div>
          {fieldType === 'select' && (
            <Field label="Options (comma separated)" className="col-span-4 max-sm:col-span-2">
              <input className="input" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="DIN, Yoke, Convertible" />
            </Field>
          )}
        </div>
        <p className="mt-3 text-xs text-abyss-400">
          Custom fields appear on every matching record — perfect for hydro test dates, O2-clean
          status, valve fittings, or anything unique to how you run your centre.
        </p>
      </div>

      <div className="card divide-y divide-abyss-100 dark:divide-abyss-800/60">
        {fields.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-abyss-400">No custom fields yet.</p>
        )}
        {fields.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="font-medium">{f.name}</span>
              <span className="ml-3 text-xs text-abyss-400">
                {f.entity === 'rental_asset' ? 'Rental assets' : 'Retail products'} · {f.fieldType}
                {f.options.length > 0 && ` · ${f.options.join(', ')}`}
              </span>
            </div>
            <button className="text-abyss-300 hover:text-red-500" onClick={() => setConfirmId(f.id)} aria-label={`Delete ${f.name}`}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete this custom field?"
        message="The field and its values on every record will be removed. This cannot be undone."
        confirmLabel="Delete field"
        danger
        onConfirm={async () => {
          if (confirmId) await window.osea.custom.delete(confirmId)
          setConfirmId(null)
          await load()
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function DataTab(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [info, setInfo] = useState<{ path: string; counts: Record<string, number> } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmImport, setConfirmImport] = useState<string | null>(null)

  useEffect(() => {
    void window.osea.data.dbInfo().then(setInfo)
  }, [])

  const backup = async (): Promise<void> => {
    const stamp = new Date().toISOString().slice(0, 10)
    const path = await window.osea.app.chooseSavePath(`osea-backup-${stamp}.db`, 'OSEA backup', ['db'])
    if (!path) return
    const result = await window.osea.data.backup(path)
    toast('success', `Backup saved (${Math.round(result.sizeBytes / 1024)} KB)`)
    await window.osea.app.showInFolder(result.path)
  }

  const pickRestore = async (): Promise<void> => {
    const path = await window.osea.app.chooseFile('OSEA backup', ['db'])
    if (path) setConfirmRestore(path)
  }

  const restore = async (): Promise<void> => {
    if (!confirmRestore) return
    const path = confirmRestore
    setConfirmRestore(null)
    try {
      await window.osea.data.restore(path)
      toast('success', 'Backup restored — reloading')
      window.setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Restore failed.')
    }
  }

  const exportJson = async (): Promise<void> => {
    const stamp = new Date().toISOString().slice(0, 10)
    const path = await window.osea.app.chooseSavePath(`osea-export-${stamp}.json`, 'JSON export', ['json'])
    if (!path) return
    const summary = await window.osea.data.exportJson(path)
    const total = summary.tables.reduce((a, t) => a + t.rows, 0)
    toast('success', `Exported ${total} rows across ${summary.tables.length} tables`)
    await window.osea.app.showInFolder(path)
  }

  const pickImport = async (): Promise<void> => {
    const path = await window.osea.app.chooseFile('JSON export', ['json'])
    if (path) setConfirmImport(path)
  }

  const importJson = async (): Promise<void> => {
    if (!confirmImport) return
    const path = confirmImport
    setConfirmImport(null)
    try {
      const summary = await window.osea.data.importJson(path)
      const total = summary.tables.reduce((a, t) => a + t.rows, 0)
      toast('success', `Imported ${total} rows — reloading`)
      window.setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Import failed.')
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-abyss-400">
          <Database size={15} /> Your database
        </h3>
        <p className="mb-3 text-sm text-abyss-500 dark:text-abyss-400">
          Everything lives in one file that you own. OSEA has no access to it — copy it, move it,
          back it up on your own terms.
        </p>
        {info && (
          <>
            <button
              className="flex items-center gap-1.5 rounded-lg bg-abyss-100 px-3 py-2 font-mono text-xs hover:bg-abyss-200 dark:bg-abyss-800/70 dark:hover:bg-abyss-800"
              onClick={() => void window.osea.app.showInFolder(info.path)}
              title="Show in folder"
            >
              <FolderOpen size={13} /> {info.path}
            </button>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-abyss-500 dark:text-abyss-400">
              <span>{info.counts['rental_assets']} rental assets</span>
              <span>{info.counts['products']} products</span>
              <span>{info.counts['sales']} sales</span>
              <span>{info.counts['purchase_orders']} purchase orders</span>
              <span>{info.counts['suppliers']} suppliers</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div className="card p-5">
          <h3 className="font-semibold">Backup Manager</h3>
          <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
            A backup is a complete snapshot of the database file. Restore replaces the current data
            with a backup. OSEA warns you before overwriting existing files.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={backup}>
              <DownloadCloud size={15} /> Back up now
            </button>
            <button className="btn-secondary" onClick={pickRestore}>
              <UploadCloud size={15} /> Restore…
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold">Export & import (JSON)</h3>
          <p className="mt-1 mb-4 text-sm text-abyss-500 dark:text-abyss-400">
            A human-readable export of every table — for audits, migrations to a future cloud
            provider, or your own tooling.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={exportJson}>
              <DownloadCloud size={15} /> Export JSON
            </button>
            <button className="btn-secondary" onClick={pickImport}>
              <UploadCloud size={15} /> Import…
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 text-sm text-abyss-500 dark:text-abyss-400">
        <h3 className="mb-1 font-semibold text-abyss-800 dark:text-abyss-100">About</h3>
        <p>
          OSEA Dive Manager 1.0.0 — Inventory Module. Part of the OSEA dive business ecosystem.
          Future modules (servicing, bookings, customers, training) plug into this same database
          and architecture.
        </p>
      </div>

      <ConfirmDialog
        open={confirmRestore !== null}
        title="Restore this backup?"
        message="Your current data will be replaced by the backup. Consider taking a fresh backup first. This cannot be undone."
        confirmLabel="Replace my data"
        danger
        onConfirm={restore}
        onCancel={() => setConfirmRestore(null)}
      />
      <ConfirmDialog
        open={confirmImport !== null}
        title="Import this export file?"
        message="All current data will be replaced by the contents of the export file. This cannot be undone."
        confirmLabel="Replace my data"
        danger
        onConfirm={importJson}
        onCancel={() => setConfirmImport(null)}
      />
    </div>
  )
}
