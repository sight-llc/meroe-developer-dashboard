import { AlertTriangle, X } from 'lucide-react'

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={
                tone === 'danger'
                  ? 'flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-misdirected'
                  : 'flex h-9 w-9 items-center justify-center rounded-full bg-vault-50 text-vault-600'
              }
            >
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          </div>
          <button onClick={onClose} className="text-ink-600/50 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-ink-600/80">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-sm border border-paper-200 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-paper-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={
              tone === 'danger'
                ? 'rounded-sm bg-misdirected px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60'
                : 'rounded-sm bg-vault-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-vault-700 disabled:opacity-60'
            }
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
