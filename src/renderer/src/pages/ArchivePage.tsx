import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import type { Product, RentalAsset } from '@shared/types'
import { CONDITION_LABELS, RENTAL_STATUS_LABELS } from '@shared/types'
import { DataTable, type Column } from '@renderer/components/DataTable'
import { ConditionBadge, RentalStatusBadge, StockBadge } from '@renderer/components/StatusBadge'
import { EmptyState, PageHeader, Spinner } from '@renderer/components/ui'
import { useApp } from '@renderer/lib/store'

type ArchiveTab = 'rental' | 'retail'

export function ArchivePage(): JSX.Element {
  const toast = useApp((s) => s.toast)
  const [tab, setTab] = useState<ArchiveTab>('rental')
  const [assets, setAssets] = useState<RentalAsset[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const archivedAssets = useMemo(() => assets.filter((asset) => asset.archived), [assets])
  const archivedProducts = useMemo(() => products.filter((product) => product.archived), [products])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [assetList, productList] = await Promise.all([
        window.osea.assets.list({ includeArchived: true }),
        window.osea.products.list({ includeArchived: true })
      ])
      setAssets(assetList)
      setProducts(productList)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not load archive.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const restoreAsset = async (asset: RentalAsset): Promise<void> => {
    setRestoringId(asset.id)
    try {
      await window.osea.assets.setArchived(asset.id, false)
      toast('success', `${asset.assetNumber} restored to active rental equipment`)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not restore rental equipment.')
    } finally {
      setRestoringId(null)
    }
  }

  const restoreProduct = async (product: Product): Promise<void> => {
    setRestoringId(product.id)
    try {
      await window.osea.products.setArchived(product.id, false)
      toast('success', `${product.sku} restored to active retail products`)
      await load()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not restore retail product.')
    } finally {
      setRestoringId(null)
    }
  }

  const assetColumns: Column<RentalAsset>[] = [
    {
      key: 'assetNumber',
      label: 'Asset number',
      sortValue: (asset) => asset.assetNumber,
      render: (asset) => <span className="font-mono font-semibold">{asset.assetNumber}</span>
    },
    {
      key: 'type',
      label: 'Type',
      sortValue: (asset) => asset.equipmentTypeName ?? '',
      render: (asset) => asset.equipmentTypeName ?? '—'
    },
    {
      key: 'brandModel',
      label: 'Brand / model',
      sortValue: (asset) => [asset.brandName, asset.model].filter(Boolean).join(' '),
      render: (asset) => [asset.brandName, asset.model].filter(Boolean).join(' / ') || '—'
    },
    {
      key: 'size',
      label: 'Size',
      sortValue: (asset) => asset.size ?? '',
      render: (asset) => asset.size ?? '—'
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (asset) => RENTAL_STATUS_LABELS[asset.status],
      render: (asset) => <RentalStatusBadge status={asset.status} />
    },
    {
      key: 'condition',
      label: 'Condition',
      sortValue: (asset) => CONDITION_LABELS[asset.condition],
      render: (asset) => <ConditionBadge condition={asset.condition} />
    },
    {
      key: 'restore',
      label: 'Restore action',
      render: (asset) => (
        <button
          className="btn-secondary"
          disabled={restoringId === asset.id}
          onClick={() => void restoreAsset(asset)}
        >
          <RotateCcw size={15} /> Restore
        </button>
      )
    }
  ]

  const productColumns: Column<Product>[] = [
    {
      key: 'sku',
      label: 'SKU',
      sortValue: (product) => product.sku,
      render: (product) => <span className="font-mono font-semibold">{product.sku}</span>
    },
    {
      key: 'name',
      label: 'Product name',
      sortValue: (product) => product.name,
      render: (product) => product.name
    },
    {
      key: 'brandCategory',
      label: 'Brand/category',
      sortValue: (product) => [product.brandName, product.categoryName].filter(Boolean).join(' '),
      render: (product) => [product.brandName, product.categoryName].filter(Boolean).join(' / ') || '—'
    },
    {
      key: 'stockQty',
      label: 'Stock quantity',
      align: 'right',
      sortValue: (product) => product.stockQty,
      render: (product) => <StockBadge qty={product.stockQty} min={product.minStock} />
    },
    {
      key: 'shelf',
      label: 'Shelf',
      sortValue: (product) => product.shelfLocation ?? '',
      render: (product) => product.shelfLocation ?? '—'
    },
    {
      key: 'restore',
      label: 'Restore action',
      render: (product) => (
        <button
          className="btn-secondary"
          disabled={restoringId === product.id}
          onClick={() => void restoreProduct(product)}
        >
          <RotateCcw size={15} /> Restore
        </button>
      )
    }
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Archive"
        subtitle="Restore rental equipment and retail products that were moved out of active use."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['rental', `Archived Rental Equipment (${archivedAssets.length})`],
            ['retail', `Archived Retail Products (${archivedProducts.length})`]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading archived records…" />
      ) : tab === 'rental' ? (
        archivedAssets.length > 0 ? (
          <DataTable
            columns={assetColumns}
            rows={archivedAssets}
            rowKey={(asset) => asset.id}
            emptyMessage="No archived rental equipment."
          />
        ) : (
          <EmptyState
            icon={<Archive size={32} />}
            title="No archived rental equipment"
            message="Archived rental assets will appear here when you move them out of active use."
          />
        )
      ) : archivedProducts.length > 0 ? (
        <DataTable
          columns={productColumns}
          rows={archivedProducts}
          rowKey={(product) => product.id}
          emptyMessage="No archived retail products."
        />
      ) : (
        <EmptyState
          icon={<Archive size={32} />}
          title="No archived retail products"
          message="Archived retail products will appear here when you move them out of active use."
        />
      )}
    </div>
  )
}
