// ─────────────────────────────────────────────────────────────────────────
// NoApiKey — banner shown on customer-related pages when no API key is selected
// ─────────────────────────────────────────────────────────────────────────

import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NoApiKey() {
  return (
    <div className="mb-6 rounded-sm border border-gold-400/40 bg-gold-400/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
        <div>
          <p className="text-sm font-medium text-gold-800">No API key selected</p>
          <p className="mt-0.5 text-xs text-gold-700/70">
            Customer data requires an active API key.{' '}
            <Link to="/keys" className="font-medium underline underline-offset-2 hover:text-gold-800">
              Select or create an API key
            </Link>{' '}
            to view customer information.
          </p>
        </div>
      </div>
    </div>
  )
}