import { ReactNode, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
  width?: string
}

/**
 * Professional data table: sticky header, sortable columns, optional row
 * selection for bulk actions, keyboard-accessible rows.
 */
export function DataTable<T>(props: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectable?: boolean
  selected?: Set<string>
  onSelectedChange?: (ids: Set<string>) => void
  emptyMessage?: string
  maxHeight?: string
}): JSX.Element {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return props.rows
    const col = props.columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return props.rows
    const copy = [...props.rows]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [props.rows, props.columns, sortKey, sortDir])

  const toggleSort = (key: string): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const allIds = useMemo(() => sorted.map(props.rowKey), [sorted, props.rowKey])
  const selected = props.selected ?? new Set<string>()
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  const toggleAll = (): void => {
    if (!props.onSelectedChange) return
    props.onSelectedChange(allSelected ? new Set() : new Set(allIds))
  }

  const toggleOne = (id: string): void => {
    if (!props.onSelectedChange) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    props.onSelectedChange(next)
  }

  if (props.rows.length === 0) {
    return (
      <div className="card px-6 py-14 text-center text-sm text-abyss-400">
        {props.emptyMessage ?? 'Nothing to show yet.'}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: props.maxHeight ?? '65vh' }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              {props.selectable && (
                <th className="table-head w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="accent-ocean-600"
                  />
                </th>
              )}
              {props.columns.map((col) => (
                <th
                  key={col.key}
                  className={`table-head px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.sortValue ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-abyss-800 dark:hover:text-abyss-200"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const id = props.rowKey(row)
              return (
                <tr
                  key={id}
                  onClick={() => props.onRowClick?.(row)}
                  tabIndex={props.onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (props.onRowClick && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                      e.preventDefault()
                      props.onRowClick(row)
                    }
                  }}
                  className={`border-b border-abyss-100 last:border-0 dark:border-abyss-800/50 ${
                    props.onRowClick
                      ? 'cursor-pointer transition-colors hover:bg-ocean-50/60 focus-visible:bg-ocean-50/60 focus-visible:outline-none dark:hover:bg-abyss-800/40 dark:focus-visible:bg-abyss-800/40'
                      : ''
                  } ${selected.has(id) ? 'bg-ocean-50/80 dark:bg-ocean-900/20' : ''}`}
                >
                  {props.selectable && (
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleOne(id)}
                        aria-label="Select row"
                        className="accent-ocean-600"
                      />
                    </td>
                  )}
                  {props.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
