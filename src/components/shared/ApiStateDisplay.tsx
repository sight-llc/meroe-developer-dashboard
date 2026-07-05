import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Spinner } from '@/components/shared/PageHeader'

interface ApiStateDisplayProps {
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * Drop-in helper for pages using useApi().
 * Shows a spinner while loading, or an inline error card with a retry button.
 * Returns null when neither loading nor error (data is ready — render your content).
 */
export function ApiStateDisplay({ loading, error, retry }: ApiStateDisplayProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-misdirected" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Failed to load</p>
          <p className="mt-1 max-w-xs text-xs text-ink-600/60">{error}</p>
        </div>
        <button
          onClick={retry}
          className="flex items-center gap-1.5 rounded-sm border border-paper-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-paper-100"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    )
  }

  return null
}
