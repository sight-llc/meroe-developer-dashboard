// ─────────────────────────────────────────────────────────────────────────
// Feature flags
//
// VITE_MOCK_UI=enabled  →  coming-soon pages render their full mock UI
// (unset / any other value)  →  coming-soon pages show the "Coming soon" UI
//
// HOW TO USE IN .env:
//   VITE_MOCK_UI=enabled
//
// HOW TO USE IN CODE:
//   import { FEATURES } from '@/lib/features'
//   if (FEATURES.MOCK_UI) { ... }
//
// Or use the wrapper component:
//   <FeaturePage feature="MOCK_UI" pageKey="overview"> ... mock UI ... </FeaturePage>
// ─────────────────────────────────────────────────────────────────────────

export const FEATURES = {
  /**
   * When true, coming-soon pages render their mock UI so you can review/develop them.
   * Pages affected: Overview, Webhooks, Reconciliation, Transfers, API Logs, Settings.
   * Set VITE_MOCK_UI=enabled in .env to activate.
   */
  MOCK_UI: import.meta.env.VITE_MOCK_UI === 'enabled',
} as const

export type FeatureKey = keyof typeof FEATURES
