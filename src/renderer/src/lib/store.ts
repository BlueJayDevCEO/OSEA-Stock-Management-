import { create } from 'zustand'
import type { BusinessSettings } from '@shared/types'
import { setCurrencySymbol } from './format'

export type Theme = 'light' | 'dark'

interface ToastItem {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

interface AppState {
  settings: BusinessSettings | null
  theme: Theme
  toasts: ToastItem[]
  searchOpen: boolean
  setSettings(settings: BusinessSettings): void
  setTheme(theme: Theme): void
  toggleTheme(): void
  toast(kind: ToastItem['kind'], message: string): void
  dismissToast(id: number): void
  setSearchOpen(open: boolean): void
}

let toastId = 0

function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('osea-theme', theme)
}

const initialTheme: Theme =
  (localStorage.getItem('osea-theme') as Theme | null) ??
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
applyThemeClass(initialTheme)

export const useApp = create<AppState>((set, get) => ({
  settings: null,
  theme: initialTheme,
  toasts: [],
  searchOpen: false,

  setSettings: (settings) => {
    setCurrencySymbol(settings.currencySymbol)
    set({ settings })
  },

  setTheme: (theme) => {
    applyThemeClass(theme)
    set({ theme })
  },

  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  toast: (kind, message) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    window.setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3500)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setSearchOpen: (open) => set({ searchOpen: open })
}))
