import type { NavKey } from '../components/BottomNav'

export type NavIntent =
  | {
      kind: 'dashboardFilters'
      municipio?: string
      product?: string
    }
  | {
      kind: 'consolidationFocus'
      municipio?: string
      product?: string
      pickupDate?: string
    }
  | {
      kind: 'createRequest'
      type?: string
      title?: string
      details?: string
      goToAfterCreate?: NavKey
    }

const KEY = 'agrotrocha.navIntent.v1'

export function setNavIntent(intent: NavIntent) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent))
  } catch {
    // ignore
  }
}

export function consumeNavIntent(): NavIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw) as NavIntent
  } catch {
    return null
  }
}
