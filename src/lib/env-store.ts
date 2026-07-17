// ─────────────────────────────────────────────────────────────────────────
// Environment Store
// Holds the dashboard's selected environment (sandbox | live) in memory.
// This controls the X-Environment header on all JWT-authenticated requests.
// Only developers with liveEnabled === true can switch to live.
// ─────────────────────────────────────────────────────────────────────────

import type { Environment } from '@/types'

const STORAGE_KEY = 'meroe_env'

function parseStored(): Environment {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === 'live' || raw === 'sandbox') return raw
  } catch { /* ignore */ }
  return 'sandbox'
}

let _env: Environment = parseStored()

export const envStore = {
  get: (): Environment => _env,
  set: (env: Environment): void => {
    _env = env
    sessionStorage.setItem(STORAGE_KEY, env)
  },
}
