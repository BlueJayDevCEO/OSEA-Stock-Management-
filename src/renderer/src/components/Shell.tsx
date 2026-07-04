import { NavLink, Outlet } from 'react-router-dom'
import {
  Anchor,
  Archive,
  BarChart3,
  LayoutDashboard,
  Moon,
  Package,
  QrCode,
  Receipt,
  Search,
  Settings,
  Sun,
  Truck,
  Waves
} from 'lucide-react'
import { useApp } from '@renderer/lib/store'
import { useGlobalScanner } from '@renderer/lib/useScanner'
import { SearchPalette } from './SearchPalette'
import { ToastHost } from './ui'

import logoPath from "../assets/osea-logo.png";

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/rental', label: 'Rental Equipment', icon: Anchor },
  { to: '/retail', label: 'Retail Shop', icon: Package },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: Truck },
  { to: '/labels', label: 'Labels & QR', icon: QrCode },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/archive', label: 'Archive', icon: Archive },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export function Shell(): JSX.Element {
  const theme = useApp((s) => s.theme)
  const toggleTheme = useApp((s) => s.toggleTheme)
  const setSearchOpen = useApp((s) => s.setSearchOpen)
  const settings = useApp((s) => s.settings)
  useGlobalScanner()

  return (
    <div className="flex h-full">
      <aside className="no-print flex w-60 shrink-0 flex-col border-r border-abyss-200/70 bg-abyss-50/60 dark:border-abyss-800/60 dark:bg-surface-card/60 max-lg:w-[68px]">
        <div className="flex items-center gap-2.5 px-5 py-5 max-lg:justify-center max-lg:px-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm">
            <img src={logoPath} alt="OSEA Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <div className="max-lg:hidden">
            <div className="text-sm font-bold leading-tight tracking-tight">OSEA</div>
            <div className="text-xs leading-tight text-abyss-400">Dive Manager</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 max-lg:px-2" aria-label="Main navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item max-lg:justify-center ${isActive ? 'nav-item-active' : ''}`
              }
              title={item.label}
            >
              <item.icon size={17} className="shrink-0" />
              <span className="max-lg:hidden">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-abyss-200/70 p-3 dark:border-abyss-800/60">
          <div className="truncate px-2 pb-2 text-xs text-abyss-400 max-lg:hidden">
            {settings?.businessName ?? ''}
          </div>
          <div className="flex items-center gap-1 max-lg:flex-col">
            <button
              className="btn-ghost flex-1 !justify-start gap-2 max-lg:!justify-center"
              onClick={() => setSearchOpen(true)}
              title="Search (Ctrl+K)"
            >
              <Search size={16} />
              <span className="max-lg:hidden">
                Search <kbd className="ml-1 rounded border border-abyss-300 px-1 text-[10px] dark:border-abyss-700">⌘K</kbd>
              </span>
            </button>
            <button
              className="btn-ghost !px-2.5"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="print-root min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-6 max-md:px-4">
          <Outlet />
        </div>
      </main>

      <SearchPalette />
      <ToastHost />
    </div>
  )
}
