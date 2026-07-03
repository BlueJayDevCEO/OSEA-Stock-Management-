import type { ConditionRating, PoStatus, RentalStatus } from '@shared/types'
import { CONDITION_LABELS, PO_STATUS_LABELS, RENTAL_STATUS_LABELS } from '@shared/types'
import { Chip } from './ui'

const STATUS_STYLES: Record<RentalStatus, string> = {
  available: 'bg-reef-500/15 text-reef-700 dark:text-reef-300',
  reserved: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  checked_out: 'bg-ocean-500/15 text-ocean-700 dark:text-ocean-300',
  returned: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  cleaning: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  inspection: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  servicing: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  damaged: 'bg-red-500/15 text-red-700 dark:text-red-300',
  lost: 'bg-abyss-500/15 text-abyss-600 dark:text-abyss-300',
  retired: 'bg-abyss-500/15 text-abyss-500 dark:text-abyss-400'
}

export function RentalStatusBadge({ status }: { status: RentalStatus }): JSX.Element {
  return <Chip className={STATUS_STYLES[status]}>{RENTAL_STATUS_LABELS[status]}</Chip>
}

const CONDITION_STYLES: Record<ConditionRating, string> = {
  excellent: 'bg-reef-500/15 text-reef-700 dark:text-reef-300',
  good: 'bg-ocean-500/15 text-ocean-700 dark:text-ocean-300',
  fair: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  poor: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  unusable: 'bg-red-500/15 text-red-700 dark:text-red-300'
}

export function ConditionBadge({ condition }: { condition: ConditionRating }): JSX.Element {
  return <Chip className={CONDITION_STYLES[condition]}>{CONDITION_LABELS[condition]}</Chip>
}

const PO_STYLES: Record<PoStatus, string> = {
  draft: 'bg-abyss-500/15 text-abyss-600 dark:text-abyss-300',
  sent: 'bg-ocean-500/15 text-ocean-700 dark:text-ocean-300',
  partial: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  completed: 'bg-reef-500/15 text-reef-700 dark:text-reef-300',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300'
}

export function PoStatusBadge({ status }: { status: PoStatus }): JSX.Element {
  return <Chip className={PO_STYLES[status]}>{PO_STATUS_LABELS[status]}</Chip>
}

export function StockBadge({ qty, min }: { qty: number; min: number }): JSX.Element {
  if (qty <= 0) return <Chip className="bg-red-500/15 text-red-700 dark:text-red-300">Out of stock</Chip>
  if (qty <= min)
    return <Chip className="bg-amber-500/15 text-amber-700 dark:text-amber-300">Low · {qty}</Chip>
  return <Chip className="bg-reef-500/15 text-reef-700 dark:text-reef-300">{qty} in stock</Chip>
}
