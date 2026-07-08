import { cn } from '@/lib/utils'

type Tone = 'matched' | 'unmatched' | 'misdirected' | 'neutral' | 'gold' | 'danger'

const TONE_CLASSES: Record<Tone, string> = {
  matched:     'bg-vault-50 text-vault-700 ring-1 ring-inset ring-vault-300/60',
  unmatched:   'bg-amber-50 text-gold-600 ring-1 ring-inset ring-gold-400/50',
  misdirected: 'bg-red-50 text-misdirected ring-1 ring-inset ring-red-300',
  neutral:     'bg-paper-200 text-ink-600 ring-1 ring-inset ring-paper-200',
  gold:        'bg-gold-400/10 text-gold-600 ring-1 ring-inset ring-gold-400/40',
  danger:      'bg-red-50 text-misdirected ring-1 ring-inset ring-red-300',
}

const STATUS_TONE_MAP: Record<string, Tone> = {
  // Reconciliation outcomes
  MATCHED: 'matched', UNDERPAID: 'unmatched', OVERPAID: 'unmatched',
  PARTIAL: 'unmatched', SPLIT: 'unmatched', MISDIRECTED: 'misdirected',
  DUPLICATE: 'unmatched', UNRESOLVED: 'unmatched', KYC_LIMIT_EXCEEDED: 'misdirected',
  // Customer/account status (uppercase — matches real backend values)
  ACTIVE: 'matched', SUSPENDED: 'misdirected', CLOSED: 'danger',
  // Virtual account status
  PROVISIONING: 'unmatched', EXPIRED: 'neutral', FAILED: 'danger',
  // KYC
  APPROVED: 'matched', REJECTED: 'danger',
  // Webhook delivery (uppercase — real backend)
  PENDING: 'unmatched', SENDING: 'unmatched', DELIVERED: 'matched', DEAD: 'danger',
  // API key status (uppercase — real backend)
  REVOKED: 'danger', ROLLING: 'unmatched',
  // Webhook subscription status (uppercase)
  PAUSED: 'neutral',
  // Transfer / transaction status
  SUBMITTED: 'unmatched', COMPLETED: 'matched', SETTLED: 'matched',
  // App status
  INACTIVE: 'neutral',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE_MAP[status] ?? 'neutral'
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium', TONE_CLASSES[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {(label ?? status).replace(/_/g, ' ')}
    </span>
  )
}
