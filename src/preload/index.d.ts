import type { OseaApi } from '@shared/api'

declare global {
  interface Window {
    osea: OseaApi
  }
}

export {}
