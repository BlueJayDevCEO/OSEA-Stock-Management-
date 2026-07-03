import QRCode from 'qrcode'

/**
 * QR codes encode the item's human-readable code (asset number / SKU).
 * Any QR or barcode scanner in keyboard-wedge mode "types" that code, and
 * the scan listener resolves it straight to the record — no searching.
 */
const cache = new Map<string, string>()

export async function qrDataUrl(code: string, sizePx = 256): Promise<string> {
  const key = `${code}@${sizePx}`
  const hit = cache.get(key)
  if (hit) return hit
  const url = await QRCode.toDataURL(code, {
    width: sizePx,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b1320', light: '#ffffff' }
  })
  cache.set(key, url)
  return url
}
