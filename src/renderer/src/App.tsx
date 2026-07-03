import { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { AppStatus } from '@shared/types'
import { useApp } from './lib/store'
import { Shell } from './components/Shell'
import { Spinner, ToastHost } from './components/ui'
import { SetupWizard } from './pages/SetupWizard'
import { DashboardPage } from './pages/DashboardPage'
import { RentalListPage } from './pages/RentalListPage'
import { RentalDetailPage } from './pages/RentalDetailPage'
import { ProductListPage } from './pages/ProductListPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { SalesPage } from './pages/SalesPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage'
import { LabelsPage } from './pages/LabelsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const setSettings = useApp((s) => s.setSettings)

  const refresh = useCallback(async () => {
    const st = await window.osea.app.getStatus()
    setStatus(st)
    if (st.configured) {
      const settings = await window.osea.settings.get()
      setSettings(settings)
    }
  }, [setSettings])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Starting OSEA Dive Manager…" />
      </div>
    )
  }

  if (!status.configured) {
    return (
      <>
        <SetupWizard onComplete={refresh} />
        <ToastHost />
      </>
    )
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="rental" element={<RentalListPage />} />
        <Route path="rental/:id" element={<RentalDetailPage />} />
        <Route path="retail" element={<ProductListPage />} />
        <Route path="retail/:id" element={<ProductDetailPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="labels" element={<LabelsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}
