import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Pencil,
  Printer,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  User,
  Wrench
} from 'lucide-react'
import type {
  ConditionRating,
  CustomFieldValue,
  RentalAsset,
  RentalEvent,
  RentalStatus
} from '@shared/types'
import { CONDITIONS, CONDITION_LABELS, RENTAL_STATUS_LABELS } from '@shared/types'
import { formatDate, formatDateTime, money, titleCase } from '@renderer/lib/format'
import { qrDataUrl } from '@renderer/lib/qr'
import { useApp } from '@renderer/lib/store'
import { ConditionBadge, RentalStatusBadge } from '@renderer/components/StatusBadge'
import { Field, Modal, PageHeader, Spinner } from '@renderer/components/ui'
import { AssetForm } from '@renderer/components/AssetForm'

interface WorkflowAction {
  label: string
  icon: JSX.Element
  primary?: boolean
  kind: 'checkout' | 'reserve' | 'transition'
  toStatus?: RentalStatus
  viaComplete?: boolean
}

function actionsFor(status: RentalStatus): WorkflowAction[] {
  switch (status) {
    case 'available':
      return [
        { label: 'Check out', icon: <User size={15} />, primary: true, kind: 'checkout' },
        { label: 'Reserve', icon: <CalendarClock size={15} />, kind: 'reserve' },
        { label: 'Inspect', icon: <SearchCheck size={15} />, kind: 'transition', toStatus: 'inspection' },
        { label: 'Service', icon: <Wrench size={15} />, kind: 'transition', toStatus: 'servicing' },
        { label: 'Report damage', icon: <ShieldAlert size={15} />, kind: 'transition', toStatus: 'damaged' },
        { label: 'Retire', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'retired' }
      ]
    case 'reserved':
      return [
        { label: 'Check out', icon: <User size={15} />, primary: true, kind: 'checkout' },
        { label: 'Cancel reservation', icon: <RotateCcw size={15} />, kind: 'transition', toStatus: 'available' }
      ]
    case 'checked_out':
      return [
        { label: 'Return', icon: <RotateCcw size={15} />, primary: true, kind: 'transition', toStatus: 'returned' },
        { label: 'Report damage', icon: <ShieldAlert size={15} />, kind: 'transition', toStatus: 'damaged' },
        { label: 'Mark lost', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'lost' }
      ]
    case 'returned':
      return [
        { label: 'Inspect', icon: <SearchCheck size={15} />, primary: true, kind: 'transition', toStatus: 'inspection' },
        { label: 'Clean', icon: <Droplets size={15} />, kind: 'transition', toStatus: 'cleaning' },
        { label: 'Back to shelf', icon: <CheckCircle2 size={15} />, kind: 'transition', toStatus: 'available' }
      ]
    case 'cleaning':
      return [
        { label: 'Ready — available', icon: <Sparkles size={15} />, primary: true, kind: 'transition', toStatus: 'available' },
        { label: 'Needs inspection', icon: <SearchCheck size={15} />, kind: 'transition', toStatus: 'inspection' },
        { label: 'Needs service', icon: <Wrench size={15} />, kind: 'transition', toStatus: 'servicing' }
      ]
    case 'inspection':
      return [
        { label: 'Pass — available', icon: <CheckCircle2 size={15} />, primary: true, kind: 'transition', toStatus: 'available' },
        { label: 'Clean', icon: <Droplets size={15} />, kind: 'transition', toStatus: 'cleaning' },
        { label: 'Needs service', icon: <Wrench size={15} />, kind: 'transition', toStatus: 'servicing' },
        { label: 'Report damage', icon: <ShieldAlert size={15} />, kind: 'transition', toStatus: 'damaged' },
        { label: 'Retire', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'retired' }
      ]
    case 'servicing':
      return [
        { label: 'Service complete', icon: <CheckCircle2 size={15} />, primary: true, kind: 'transition', toStatus: 'available', viaComplete: true },
        { label: 'Report damage', icon: <ShieldAlert size={15} />, kind: 'transition', toStatus: 'damaged' },
        { label: 'Retire', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'retired' }
      ]
    case 'damaged':
      return [
        { label: 'Send to service', icon: <Wrench size={15} />, primary: true, kind: 'transition', toStatus: 'servicing' },
        { label: 'Inspect', icon: <SearchCheck size={15} />, kind: 'transition', toStatus: 'inspection' },
        { label: 'Back to available', icon: <CheckCircle2 size={15} />, kind: 'transition', toStatus: 'available' },
        { label: 'Retire', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'retired' },
        { label: 'Mark lost', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'lost' }
      ]
    case 'lost':
      return [
        { label: 'Found — available', icon: <CheckCircle2 size={15} />, primary: true, kind: 'transition', toStatus: 'available' },
        { label: 'Retire', icon: <ClipboardList size={15} />, kind: 'transition', toStatus: 'retired' }
      ]
    case 'retired':
      return [{ label: 'Reinstate', icon: <RotateCcw size={15} />, kind: 'transition', toStatus: 'available' }]
  }
}

const EVENT_ICON: Record<string, JSX.Element> = {
  created: <Sparkles size={14} />,
  reserved: <CalendarClock size={14} />,
  checked_out: <User size={14} />,
  returned: <RotateCcw size={14} />,
  inspection: <SearchCheck size={14} />,
  cleaning: <Droplets size={14} />,
  service: <Wrench size={14} />,
  damage_reported: <ShieldAlert size={14} />,
  status_change: <ClipboardList size={14} />,
  condition_change: <ClipboardList size={14} />,
  note: <Pencil size={14} />
}

export function RentalDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useApp((s) => s.toast)
  const settings = useApp((s) => s.settings)

  const [asset, setAsset] = useState<RentalAsset | null>(null)
  const [events, setEvents] = useState<RentalEvent[]>([])
  const [customValues, setCustomValues] = useState<CustomFieldValue[]>([])
  const [qr, setQr] = useState('')
  const [tab, setTab] = useState<'history' | 'service' | 'details'>('history')
  const [editOpen, setEditOpen] = useState(false)

  // action modal state
  const [action, setAction] = useState<WorkflowAction | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [dueBack, setDueBack] = useState('')
  const [notes, setNotes] = useState('')
  const [condition, setCondition] = useState<ConditionRating | ''>('')
  const [noteDraft, setNoteDraft] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const a = await window.osea.assets.get(id)
    setAsset(a)
    if (a) {
      setEvents(await window.osea.assets.events(a.id))
      setCustomValues(await window.osea.custom.values('rental_asset', a.id))
      setQr(await qrDataUrl(a.assetNumber))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const openAction = (a: WorkflowAction): void => {
    setCustomerName('')
    setStaffName(settings?.staffName ?? '')
    setDueBack('')
    setNotes('')
    setCondition('')
    setAction(a)
  }

  const runAction = async (): Promise<void> => {
    if (!asset || !action) return
    try {
      if (action.kind === 'checkout' || action.kind === 'reserve') {
        const input = {
          customerName,
          staffName: staffName || null,
          dueBack: dueBack || null,
          notes: notes || null
        }
        if (action.kind === 'checkout') await window.osea.assets.checkOut(asset.id, input)
        else await window.osea.assets.reserve(asset.id, input)
      } else if (action.toStatus === 'returned') {
        await window.osea.assets.return(asset.id, {
          staffName: staffName || null,
          notes: notes || null,
          condition: condition || null
        })
      } else if (action.viaComplete) {
        await window.osea.assets.completeService(asset.id, {
          staffName: staffName || null,
          notes: notes || null,
          condition: condition || null
        })
      } else if (action.toStatus) {
        await window.osea.assets.setStatus(asset.id, action.toStatus, {
          staffName: staffName || null,
          notes: notes || null,
          condition: condition || null
        })
      }
      toast('success', `${asset.assetNumber}: ${action.label} recorded`)
      setAction(null)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Action failed.')
    }
  }

  const addNote = async (): Promise<void> => {
    if (!asset || !noteDraft.trim()) return
    await window.osea.assets.addNote(asset.id, noteDraft.trim(), settings?.staffName || null)
    setNoteDraft('')
    await load()
    toast('success', 'Note added to the passport')
  }

  const archiveAsset = async (): Promise<void> => {
    if (!asset) return
    if (asset.status === 'checked_out' || asset.status === 'reserved') {
      toast('error', 'Return checked-out equipment or cancel the reservation before archiving.')
      return
    }
    try {
      await window.osea.assets.setArchived(asset.id, true)
      toast('success', `${asset.assetNumber} moved to archive`)
      navigate('/archive')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not archive rental equipment.')
    }
  }

  const setCustomValue = async (fieldId: string, value: string): Promise<void> => {
    if (!asset) return
    await window.osea.custom.setValue(fieldId, asset.id, value || null)
    setCustomValues(await window.osea.custom.values('rental_asset', asset.id))
  }

  const serviceEvents = useMemo(
    () => events.filter((e) => ['service', 'inspection', 'damage_reported'].includes(e.eventType)),
    [events]
  )

  if (!asset) return <Spinner label="Opening equipment passport…" />

  const title = [asset.brandName, asset.model].filter(Boolean).join(' ') || asset.equipmentTypeName || asset.assetNumber

  return (
    <div className="animate-fade-in">
      <Link to="/rental" className="mb-3 inline-flex items-center gap-1.5 text-sm text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200">
        <ArrowLeft size={15} /> Rental equipment
      </Link>

      <PageHeader
        title={title}
        subtitle={`${asset.equipmentTypeName ?? 'Equipment'} · Passport ${asset.assetNumber}`}
        actions={
          <>
            {!asset.archived && (
              <button className="btn-secondary" onClick={() => void archiveAsset()}>
                <Archive size={15} /> Archive
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => navigate(`/labels?kind=asset&ids=${asset.id}`)}
            >
              <Printer size={15} /> Print label
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Edit
            </button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        {/* Left: identity card */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <RentalStatusBadge status={asset.status} />
                <ConditionBadge condition={asset.condition} />
              </div>
              <div className="font-mono text-sm font-bold">{asset.assetNumber}</div>
              {asset.serialNumber && (
                <div className="mt-0.5 text-xs text-abyss-400">S/N {asset.serialNumber}</div>
              )}
            </div>
            {qr && (
              <img
                src={qr}
                alt={`QR code for ${asset.assetNumber}`}
                className="h-24 w-24 rounded-lg border border-abyss-200 bg-white p-1 dark:border-abyss-700"
              />
            )}
          </div>

          {asset.status === 'checked_out' && (
            <div className="mt-4 rounded-lg bg-ocean-500/10 p-3 text-sm">
              <div className="font-semibold text-ocean-700 dark:text-ocean-300">
                With {asset.currentRenter ?? 'customer'}
              </div>
              {asset.dueBack && (
                <div className="text-xs text-abyss-500 dark:text-abyss-400">
                  Due back {formatDate(asset.dueBack)}
                </div>
              )}
            </div>
          )}

          <dl className="mt-4 space-y-2 text-sm">
            {[
              ['Category', asset.categoryName],
              ['Size', asset.size],
              ['Colour', asset.colour],
              ['Purchased', asset.purchaseDate ? formatDate(asset.purchaseDate) : null],
              ['Purchase price', asset.purchasePrice != null ? money(asset.purchasePrice) : null],
              ['Replacement value', asset.replacementValue != null ? money(asset.replacementValue) : null],
              ['Warranty until', asset.warrantyExpiry ? formatDate(asset.warrantyExpiry) : null],
              ['Supplier', asset.supplierName]
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3">
                  <dt className="text-abyss-400">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>

          {(asset.serviceIntervalDays || asset.nextServiceDate) && (
            <div className="mt-4 rounded-lg border border-abyss-200/70 p-3 text-sm dark:border-abyss-700/60">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <Wrench size={14} /> Servicing
              </div>
              <div className="flex justify-between text-xs text-abyss-500 dark:text-abyss-400">
                <span>Last: {formatDate(asset.lastServiceDate)}</span>
                <span
                  className={
                    asset.nextServiceDate && asset.nextServiceDate <= new Date().toISOString().slice(0, 10)
                      ? 'font-semibold text-red-500'
                      : ''
                  }
                >
                  Next: {formatDate(asset.nextServiceDate)}
                </span>
              </div>
            </div>
          )}

          {customValues.length > 0 && (
            <div className="mt-4 border-t border-abyss-200/70 pt-4 dark:border-abyss-800/60">
              <div className="label">Custom fields</div>
              <div className="space-y-2">
                {customValues.map((cv) => (
                  <div key={cv.fieldId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-abyss-400">{cv.fieldName}</span>
                    {cv.fieldType === 'select' ? (
                      <select
                        className="input !w-40 !py-1 !text-xs"
                        value={cv.value ?? ''}
                        onChange={(e) => void setCustomValue(cv.fieldId, e.target.value)}
                      >
                        <option value="">—</option>
                        {cv.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input !w-40 !py-1 !text-xs"
                        type={cv.fieldType === 'number' ? 'number' : cv.fieldType === 'date' ? 'date' : 'text'}
                        defaultValue={cv.value ?? ''}
                        onBlur={(e) => void setCustomValue(cv.fieldId, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {asset.notes && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-abyss-50 p-3 text-sm text-abyss-600 dark:bg-abyss-800/50 dark:text-abyss-300">
              {asset.notes}
            </p>
          )}
        </div>

        {/* Right: workflow + history */}
        <div className="col-span-2 max-lg:col-span-1">
          <div className="card mb-4 p-5">
            <div className="label">Workflow — {RENTAL_STATUS_LABELS[asset.status]}</div>
            <div className="flex flex-wrap gap-2">
              {actionsFor(asset.status).map((a) => (
                <button
                  key={a.label}
                  className={a.primary ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => openAction(a)}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex gap-1 border-b border-abyss-200/70 px-3 pt-2 dark:border-abyss-800/60">
              {(
                [
                  ['history', `History (${events.length})`],
                  ['service', `Service & inspections (${serviceEvents.length})`],
                  ['details', 'Add note']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-t-lg px-3.5 py-2 text-sm font-medium ${
                    tab === key
                      ? 'border-b-2 border-ocean-500 text-ocean-700 dark:text-ocean-300'
                      : 'text-abyss-400 hover:text-abyss-700 dark:hover:text-abyss-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-5">
              {tab === 'details' ? (
                <div>
                  <textarea
                    className="input min-h-[90px]"
                    placeholder="Write a note for this asset's permanent record…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <button className="btn-primary" onClick={addNote} disabled={!noteDraft.trim()}>
                      Add note
                    </button>
                  </div>
                </div>
              ) : (
                <ol className="relative space-y-4 border-l border-abyss-200 pl-5 dark:border-abyss-800">
                  {(tab === 'history' ? events : serviceEvents).map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-ocean-500/15 text-ocean-600 ring-4 ring-white dark:text-ocean-300 dark:ring-surface-card">
                        {EVENT_ICON[e.eventType] ?? <ClipboardList size={12} />}
                      </span>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-semibold">{titleCase(e.eventType)}</span>
                        <span className="text-xs text-abyss-400">{formatDateTime(e.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-abyss-500 dark:text-abyss-400">
                        {[
                          e.customerName && `Customer: ${e.customerName}`,
                          e.staffName && `Staff: ${e.staffName}`,
                          e.dueDate && `Due: ${formatDate(e.dueDate)}`,
                          e.condition && `Condition: ${CONDITION_LABELS[e.condition]}`
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {e.notes && (
                        <p className="mt-1 text-sm text-abyss-600 dark:text-abyss-300">{e.notes}</p>
                      )}
                    </li>
                  ))}
                  {(tab === 'history' ? events : serviceEvents).length === 0 && (
                    <p className="py-4 text-sm text-abyss-400">Nothing recorded yet.</p>
                  )}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow action modal */}
      <Modal
        open={action !== null}
        title={action ? `${action.label} — ${asset.assetNumber}` : ''}
        onClose={() => setAction(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAction(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={runAction}>
              {action?.label}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {(action?.kind === 'checkout' || action?.kind === 'reserve') && (
            <>
              <Field label="Customer name *" className="col-span-2 max-sm:col-span-1">
                <input
                  className="input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Due back">
                <input
                  className="input"
                  type="date"
                  value={dueBack}
                  onChange={(e) => setDueBack(e.target.value)}
                />
              </Field>
            </>
          )}
          {action?.kind === 'transition' && (
            <Field label="Condition after this step">
              <select
                className="input"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ConditionRating | '')}
              >
                <option value="">Unchanged</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {CONDITION_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Staff member">
            <input
              className="input"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </Field>
          <Field label="Notes" className="col-span-2 max-sm:col-span-1">
            <textarea
              className="input min-h-[64px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <AssetForm open={editOpen} asset={asset} onClose={() => setEditOpen(false)} onSaved={load} />
    </div>
  )
}
