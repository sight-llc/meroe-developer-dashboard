// ─────────────────────────────────────────────────────────────────────────
// MockBadge — small badge indicating a feature uses mock data (no backend)
// ─────────────────────────────────────────────────────────────────────────

import { FlaskConical } from 'lucide-react'

export function MockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-gold-300/50 bg-gold-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold-700">
      <FlaskConical className="h-2.5 w-2.5" />
      Mock
    </span>
  )
}