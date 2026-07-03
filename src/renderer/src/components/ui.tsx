import { ReactNode, useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { useApp } from '@renderer/lib/store'

// --- Page scaffolding --------------------------------------------------------

export function PageHeader(props: {
  title: string
  subtitle?: string
  actions?: ReactNode
}): JSX.Element {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{props.title}</h1>
        {props.subtitle && (
          <p className="mt-1 text-sm text-abyss-500 dark:text-abyss-400">{props.subtitle}</p>
        )}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </div>
  )
}

export function Field(props: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}): JSX.Element {
  return (
    <div className={props.className}>
      <label className="label">{props.label}</label>
      {props.children}
      {props.hint && <p className="mt-1 text-xs text-abyss-400">{props.hint}</p>}
    </div>
  )
}

export function EmptyState(props: {
  icon?: ReactNode
  title: string
  message?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      {props.icon && <div className="mb-4 text-abyss-300 dark:text-abyss-600">{props.icon}</div>}
      <h3 className="text-base font-semibold">{props.title}</h3>
      {props.message && (
        <p className="mt-1 max-w-md text-sm text-abyss-500 dark:text-abyss-400">{props.message}</p>
      )}
      {props.action && <div className="mt-5">{props.action}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-abyss-400">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label ?? 'Loading…'}</span>
    </div>
  )
}

// --- Modal ---------------------------------------------------------------------

export function Modal(props: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose()
    }
    if (props.open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.open, props.onClose])

  if (!props.open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss-950/50 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
    >
      <div
        ref={ref}
        className={`card w-full ${props.wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] overflow-hidden animate-slide-up`}
      >
        <div className="flex items-center justify-between border-b border-abyss-200/70 px-5 py-4 dark:border-abyss-800/60">
          <h2 className="text-base font-semibold">{props.title}</h2>
          <button className="btn-ghost -mr-2 !p-1.5" onClick={props.onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(88vh-8.5rem)] overflow-y-auto px-5 py-4">{props.children}</div>
        {props.footer && (
          <div className="flex justify-end gap-2 border-t border-abyss-200/70 px-5 py-3.5 dark:border-abyss-800/60">
            {props.footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmDialog(props: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element | null {
  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onCancel}
      footer={
        <>
          <button className="btn-secondary" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className={props.danger ? 'btn-danger' : 'btn-primary'}
            onClick={props.onConfirm}
          >
            {props.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      <p className="text-sm text-abyss-600 dark:text-abyss-300">{props.message}</p>
    </Modal>
  )
}

// --- Toasts ---------------------------------------------------------------------

export function ToastHost(): JSX.Element {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-96 max-w-[90vw] flex-col gap-2 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-pop animate-slide-up ${
            t.kind === 'success'
              ? 'border-reef-500/30 bg-white text-reef-800 dark:bg-surface-raised dark:text-reef-300'
              : t.kind === 'error'
                ? 'border-red-500/30 bg-white text-red-700 dark:bg-surface-raised dark:text-red-300'
                : 'border-ocean-500/30 bg-white text-ocean-800 dark:bg-surface-raised dark:text-ocean-300'
          }`}
          role="status"
        >
          {t.kind === 'success' ? (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          ) : t.kind === 'error' ? (
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          ) : (
            <Info size={17} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-50 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

// --- Small bits -------------------------------------------------------------------

export function Chip(props: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${props.className ?? 'bg-abyss-100 text-abyss-600 dark:bg-abyss-800 dark:text-abyss-300'}`}
    >
      {props.children}
    </span>
  )
}

export function StatCard(props: {
  label: string
  value: string
  sub?: string
  accent?: 'ocean' | 'reef' | 'amber' | 'red' | 'none'
  icon?: ReactNode
  onClick?: () => void
}): JSX.Element {
  const accents = {
    ocean: 'text-ocean-600 dark:text-ocean-300 bg-ocean-500/10',
    reef: 'text-reef-700 dark:text-reef-300 bg-reef-500/10',
    amber: 'text-amber-600 dark:text-amber-300 bg-amber-500/10',
    red: 'text-red-600 dark:text-red-300 bg-red-500/10',
    none: 'text-abyss-500 dark:text-abyss-300 bg-abyss-500/10'
  }
  const Tag = props.onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={props.onClick}
      className={`card flex items-center gap-4 p-5 text-left ${props.onClick ? 'transition-transform hover:-translate-y-0.5' : ''}`}
    >
      {props.icon && (
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accents[props.accent ?? 'ocean']}`}
        >
          {props.icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-abyss-400">
          {props.label}
        </div>
        <div className="mt-0.5 truncate text-xl font-bold tabular-nums tracking-tight">
          {props.value}
        </div>
        {props.sub && <div className="truncate text-xs text-abyss-400">{props.sub}</div>}
      </div>
    </Tag>
  )
}
