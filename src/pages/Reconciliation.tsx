import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { CheckCircle2, AlertTriangle, XCircle, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { MockBadge } from '@/components/shared/MockBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { FeaturePage } from '@/components/shared/FeaturePage'
import { getReconciliationSummary, getMisdirectedQueue, confirmCorrect, initiateRefund } from '@/lib/api'
import { formatNgn, formatDateTime } from '@/lib/utils'
import type { MisdirectedQueueItem } from '@/types'
import { useNavigate } from 'react-router-dom'

function ReconciliationContent() {
  const queryClient = useQueryClient()
  const { data: summary, isLoading: sumLoading, error: sumError, refetch: sumRefetch } = useQuery({
    queryKey: ['reconciliation-summary'],
    queryFn: getReconciliationSummary,
  })
  const { data: queue, isLoading: qLoading, error: qError, refetch: qRefetch } = useQuery<MisdirectedQueueItem[]>({
    queryKey: ['misdirected-queue'],
    queryFn: getMisdirectedQueue,
  })
  const [actionTarget, setActionTarget] = useState<{ item: MisdirectedQueueItem; action: 'confirm' | 'refund' } | null>(null)
  const navigate = useNavigate()

  const confirmMutation = useMutation({
    mutationFn: confirmCorrect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misdirected-queue'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-summary'] })
      toast.success('Payment confirmed and matched')
      setActionTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const refundMutation = useMutation({
    mutationFn: initiateRefund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misdirected-queue'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-summary'] })
      toast.success('Refund initiated')
      setActionTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const loading = sumLoading || qLoading
  const error = sumError || qError
  const retry = () => { sumRefetch(); qRefetch() }

  const stateNode = <ApiStateDisplay loading={loading} error={error?.message ?? null} retry={retry} />
  if (loading || error) return stateNode

  return (
    <div>
      <PageHeader eyebrow="Ledger" title="Reconciliation board" description="Inbound payments auto-matched against expected customers, with anomalies flagged for review." />

      <div className="mb-4 flex items-center gap-2">
        <MockBadge />
        <span className="text-xs text-ink-600/50">Backend reconciliation endpoints not yet available — data is simulated</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="panel !p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-vault-50 text-vault-600"><CheckCircle2 className="h-4 w-4" strokeWidth={1.75} /></div>
            <p className="label-eyebrow">Matched</p>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-vault-700">{(summary?.matched ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="panel !p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-gold-400/10 text-gold-600"><AlertTriangle className="h-4 w-4" strokeWidth={1.75} /></div>
            <p className="label-eyebrow">Unmatched</p>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-gold-600">{(summary?.unmatched ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="panel !p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-red-50 text-misdirected"><XCircle className="h-4 w-4" strokeWidth={1.75} /></div>
            <p className="label-eyebrow">Misdirected</p>
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-misdirected">{(summary?.misdirected ?? 0).toLocaleString()}</p>
        </Card>
      </div>

      <div className="mt-5">
        <p className="label-eyebrow mb-3">Misdirected payment queue</p>
        <Card className="panel !p-0">
          {(queue ?? []).length === 0 ? (
            <EmptyState icon={Scale} title="Queue is clear" description="No misdirected payments awaiting review." />
          ) : (
            <ul className="divide-y divide-paper-200">
              {(queue ?? []).map((item) => (
                <li key={item.transactionId} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{item.senderName}</p>
                      <span className="text-xs text-ink-600/40">→</span>
                      <button onClick={() => navigate(`/customers/${item.customerId}`)} className="text-sm text-vault-600 hover:underline">{item.customerName}</button>
                    </div>
                    <p className="mt-1 text-xs text-ink-600/60">{item.senderBank} · {formatDateTime(item.detectedAt)}</p>
                    <span className="mt-2 inline-block rounded-sm bg-red-50 px-2 py-0.5 text-[11px] font-medium text-misdirected">{item.flagReason.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="font-mono text-sm font-semibold tabular-nums text-ink">{formatNgn(item.amount)}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setActionTarget({ item, action: 'confirm' })} className="rounded-sm border border-paper-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-paper-100">Confirm correct</button>
                      <button onClick={() => setActionTarget({ item, action: 'refund' })} className="rounded-sm bg-misdirected px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800">Initiate refund</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={!!actionTarget}
        title={actionTarget?.action === 'confirm' ? 'Confirm this payment is correct?' : 'Initiate refund?'}
        description={
          actionTarget?.action === 'confirm'
            ? `This moves ${actionTarget ? formatNgn(actionTarget.item.amount) : ''} from suspense into ${actionTarget?.item.customerName}'s available balance.`
            : `This reverses the transaction and sends ${actionTarget ? formatNgn(actionTarget.item.amount) : ''} back to ${actionTarget?.item.senderName} via ${actionTarget?.item.senderBank}.`
        }
        confirmLabel={actionTarget?.action === 'confirm' ? 'Confirm correct' : 'Initiate refund'}
        tone={actionTarget?.action === 'confirm' ? 'default' : 'danger'}
        loading={confirmMutation.isPending || refundMutation.isPending}
        onConfirm={() => {
          if (!actionTarget) return
          if (actionTarget.action === 'confirm') confirmMutation.mutate(actionTarget.item.transactionId)
          else refundMutation.mutate(actionTarget.item.transactionId)
        }}
        onClose={() => setActionTarget(null)}
      />
    </div>
  )
}

export default function Reconciliation() {
  return (
    <FeaturePage
      feature="MOCK_UI"
      comingSoon={{
        icon: Scale,
        title: 'Reconciliation Board',
        description: 'Live view of matched, unmatched, and misdirected inbound payments, with a review queue for flagged transactions.',
        features: [
          'Matched / Unmatched / Misdirected KPI cards',
          'Misdirected payment queue with confirm and refund actions',
          'Full reconciliation outcome breakdown (9 statuses)',
          'Audit trail per resolved transaction',
        ],
        eta: 'Phase 2 — reconciliation controller',
      }}
    >
      <ReconciliationContent />
    </FeaturePage>
  )
}