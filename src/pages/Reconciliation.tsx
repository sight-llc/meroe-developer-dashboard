import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { CheckCircle2, AlertTriangle, XCircle, Scale, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { NoApiKey } from '@/components/shared/NoApiKey'
import { RequireApiKeyModal } from '@/components/shared/RequireApiKeyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getReconciliationSummary, getMisdirectedQueue, confirmCorrect, initiateRefund, getApiKeys } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { formatNgn, formatDateTime } from '@/lib/utils'
import type { MisdirectedQueueItem, ApiKey } from '@/types'
import { useNavigate } from 'react-router-dom'

function ReconciliationContent() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [refundTarget, setRefundTarget] = useState<MisdirectedQueueItem | null>(null)
  const [refundPin, setRefundPin] = useState('')

  const hasActiveKey = !!activeKeyStore.get()

  const { data: apiKeys } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => getApiKeys(),
  })

  const { data: summary, isLoading: sumLoading, error: sumError, refetch: sumRefetch } = useQuery({
    queryKey: ['reconciliation-summary'],
    queryFn: getReconciliationSummary,
    enabled: hasActiveKey,
  })
  const { data: queue, isLoading: qLoading, error: qError, refetch: qRefetch } = useQuery<MisdirectedQueueItem[]>({
    queryKey: ['misdirected-queue'],
    queryFn: getMisdirectedQueue,
    enabled: hasActiveKey,
  })

  const confirmMutation = useMutation({
    mutationFn: confirmCorrect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misdirected-queue'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-summary'] })
      toast.success('Payment confirmed and matched')
      setRefundTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const refundMutation = useMutation({
    mutationFn: (input: { txId: string; pin?: string }) => initiateRefund(input.txId, input.pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misdirected-queue'] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-summary'] })
      toast.success('Refund initiated')
      setRefundTarget(null)
      setRefundPin('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Refund failed'),
  })

  const loading = sumLoading || qLoading
  const error = sumError || qError
  const retry = () => { sumRefetch(); qRefetch() }

  // API key gating
  if (!hasActiveKey) {
    return (
      <div>
        <PageHeader eyebrow="Ledger" title="Reconciliation board" description="Inbound payments auto-matched against expected customers, with anomalies flagged for review." />
        <NoApiKey />
        {showKeyModal && (
          <RequireApiKeyModal
            apiKeys={apiKeys ?? []}
            onKeySet={() => {
              setShowKeyModal(false)
              queryClient.invalidateQueries({ queryKey: ['reconciliation-summary'] })
              queryClient.invalidateQueries({ queryKey: ['misdirected-queue'] })
            }}
          />
        )}
      </div>
    )
  }

  const stateNode = <ApiStateDisplay loading={loading} error={error?.message ?? null} retry={retry} />
  if (loading || error) return stateNode

  return (
    <div>
      <PageHeader eyebrow="Ledger" title="Reconciliation board" description="Inbound payments auto-matched against expected customers, with anomalies flagged for review." />

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
                      {item.customerId ? (
                        <button onClick={() => navigate(`/customers/${item.customerId}`)} className="text-sm text-vault-600 hover:underline font-mono">{item.customerId.slice(0, 12)}…</button>
                      ) : (
                        <span className="text-sm text-ink-600/40">unknown</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-600/60">{item.senderBank} · {formatDateTime(item.detectedAt)}</p>
                    <span className="mt-2 inline-block rounded-sm bg-red-50 px-2 py-0.5 text-[11px] font-medium text-misdirected">{item.flagReason.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="font-mono text-sm font-semibold tabular-nums text-ink">{formatNgn(item.amount)}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => confirmMutation.mutate(item.transactionId)} disabled={confirmMutation.isPending} className="rounded-sm border border-paper-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-paper-100 disabled:opacity-60">Confirm correct</button>
                      <button onClick={() => setRefundTarget(item)} className="rounded-sm bg-misdirected px-2.5 py-1 text-xs font-medium text-white hover:bg-red-800">Initiate refund</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Refund PIN modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-misdirected">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Initiate refund</h3>
                <p className="text-xs text-ink-600/60">
                  {formatNgn(refundTarget.amount)} → {refundTarget.senderName}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-sm border border-paper-200 bg-paper-100 px-3 py-2 text-xs text-ink-600">
                <p>This sends the funds back to {refundTarget.senderName} via {refundTarget.senderBank}. Requires your transaction PIN.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="refund-pin">Transaction PIN</Label>
                <Input
                  id="refund-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={refundPin}
                  onChange={(e) => setRefundPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="font-mono text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRefundTarget(null); setRefundPin('') }}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={refundMutation.isPending} onClick={() => {
                if (!refundTarget) return
                refundMutation.mutate({ txId: refundTarget.transactionId, pin: refundPin || undefined })
              }}>
                {refundMutation.isPending && <Spinner className="h-3.5 w-3.5 text-white" />}
                Confirm refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Reconciliation() {
  return <ReconciliationContent />
}
