// ─────────────────────────────────────────────────────────────────────────
// Active API Key Store
// Holds the developer's selected API key in memory + sessionStorage.
// The developer picks one key per session; it's used for customer-related
// API calls (Authorization: Bearer <rawKey>).
// ─────────────────────────────────────────────────────────────────────────

import type { Environment } from '@/types'

export interface ActiveKey {
  rawKey: string
  keyPrefix: string
  lastFour: string
  appName?: string
  appId?: string
  environment: Environment
}

const STORAGE_KEY = 'meroe_active_key'

function parseStored(): ActiveKey | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveKey) : null
  } catch {
    return null
  }
}

function store(key: ActiveKey | null) {
  if (key) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(key))
  } else {
    sessionStorage.removeItem(STORAGE_KEY)
  }
}

let _active: ActiveKey | null = parseStored()

export const activeKeyStore = {
  get: (): ActiveKey | null => _active,
  set: (key: ActiveKey): void => {
    _active = key
    store(key)
  },
  clear: (): void => {
    _active = null
    store(null)
  },
  /** Display label like "nv_test_sk_••••a1b2" */
  getLabel: (): string | null => {
    if (!_active) return null
    return `${_active.keyPrefix}••••${_active.lastFour}`
  },
  /** Get the active key's environment */
  getEnvironment: (): Environment | null => {
    return _active?.environment ?? null
  },
}
