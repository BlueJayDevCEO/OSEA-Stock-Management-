import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from './store'

/**
 * Global keyboard-wedge scanner support.
 *
 * USB QR/barcode scanners type the code as very fast keystrokes ending with
 * Enter. This hook watches for that signature anywhere in the app (except
 * inside form fields), resolves the code against assets then products, and
 * jumps straight to the record — scan a tag, see the passport.
 */
export function useGlobalScanner(): void {
  const navigate = useNavigate()
  const toast = useApp((s) => s.toast)

  useEffect(() => {
    let buffer = ''
    let lastKeyAt = 0

    const isFormField = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    const resolve = async (code: string): Promise<void> => {
      try {
        if (code.startsWith('AST-') || code.startsWith('CYL-')) {
          const asset = await window.osea.assets.getByNumber(code)
          if (asset) navigate(`/rental/${asset.id}`)
          else toast('info', `Rental asset "${code}" not found.`)
        } else if (code.startsWith('RTL-')) {
          const product = await window.osea.products.getByCode(code)
          if (product) navigate(`/retail/${product.id}`)
          else toast('info', `Retail product "${code}" not found.`)
        } else {
          // Fallback for legacy items without prefixes
          const asset = await window.osea.assets.getByNumber(code)
          if (asset) {
            navigate(`/rental/${asset.id}`)
            return
          }
          const product = await window.osea.products.getByCode(code)
          if (product) {
            navigate(`/retail/${product.id}`)
            return
          }
          toast('info', `No item found for scanned code "${code}"`)
        }
      } catch (err) {
        toast('error', err instanceof Error ? err.message : 'Scan lookup failed')
      }
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isFormField(e.target)) return
      const now = Date.now()
      if (now - lastKeyAt > 80) buffer = ''
      lastKeyAt = now

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          const code = buffer
          buffer = ''
          void resolve(code)
        }
        return
      }
      if (e.key.length === 1) buffer += e.key
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, toast])
}
