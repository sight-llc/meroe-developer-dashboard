import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { ArrowUpRight, Plus, Info, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { FeaturePage } from '@/components/shared/FeaturePage'
import { NoApiKey } from '@/components/shared/NoApiKey'
import { RequireApiKeyModal } from '@/components/shared/RequireApiKeyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getOutboundTransfers, initiateTransfer, approveTransfer, rejectTransfer, getApps, getApiKeys } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { formatNgn, formatDateTime } from '@/lib/utils'
import type { App, OutboundTransfer, SubAccountType, TransferStatus, ApiKey } from '@/types'

const STATUS_FILTERS: { value: TransferStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
]

function TransfersContent() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TransferStatus | 'ALL'>('ALL')
  const [formOpen, setFormOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<OutboundTransfer | null>(null)
  const [rejectTarget, setRejectTarget] = useState<OutboundTransfer | null>(null)
  const [showKeyModal, setShowKeyModal] = useState(false)

  const hasActiveKey = !!activeKeyStore.get()

  const { data: apps } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: getApps,
  })

  const { data: apiKeys } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => getApiKeys(),
  })

  const { data: transfers, isLoading, error, refetch } = useQuery<OutboundTransfer[]>({
    queryKey: ['transfers', status],
    queryFn: () => getOutboundTransfers({ status: status === 'ALL' ? undefined : status }),
    enabled: hasActiveKey,
  })

  const approveMutation = useMutation({
    mutationFn: approveTransfer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success(`Transfer approved — Nomba ref: ${data.nombaTransferId ?? 'pending'}`)
      setApproveTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Approval failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectTransfer(id, 'Rejected via dashboard'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfer rejected')
      setRejectTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Rejection failed'),
  })

  // Show modal on initial load if no active key is set
  useEffect(() => {
    if (!hasActiveKey) {
      setShowKeyModal(true)
    }
  }, [hasActiveKey])

  // If no active key, show the NoApiKey banner and the modal
  if (!hasActiveKey) {
    return (
      <div>
        <PageHeader
          eyebrow="Ledger"
          title="Outbound transfers"
          description="Customer withdrawals (VAULT) and your revenue payouts (OPS) to external Nigerian bank accounts."
        />
        <NoApiKey />
        {showKeyModal && (
          <RequireApiKeyModal
            apiKeys={apiKeys ?? []}
            onKeySet={() => {
              setShowKeyModal(false)
              queryClient.invalidateQueries({ queryKey: ['transfers'] })
            }}
          />
        )}
      </div>
    )
  }

  const pendingCount = (transfers ?? []).filter((t) => t.status === 'PENDING').length

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Outbound transfers"
        description="Customer withdrawals (VAULT) and your revenue payouts (OPS) to external Nigerian bank accounts."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New transfer</Button>}
      />

      {pendingCount > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-sm border border-gold-400/40 bg-gold-400/10 px-3.5 py-2.5 text-sm text-ink-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <p>
            <span className="font-medium text-ink">{pendingCount} transfer{pendingCount > 1 ? 's' : ''}</span> awaiting
            approval — use the Approve / Reject buttons to action them. Above-threshold transfers require a second approver.
          </p>
        </div>
      )}

      <div className="mb-4">
        <Select value={status} onValueChange={(v) => setStatus(v as TransferStatus | 'ALL')}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="panel !p-0">
        {(transfers ?? []).length === 0 ? (
          <EmptyState icon={ArrowUpRight} title="No transfers yet" description="Initiate a transfer to send funds to an external bank account." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                <th className="px-5 py-3 font-medium">Destination</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {(transfers ?? []).map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-ink">{t.destinationAccountName}</p>
                    <p className="font-mono text-xs text-ink-600/50">
                      {t.destinationAccountNumber} · {t.destinationBankCode}
                    </p>
                    {t.failureReason && (
                      <p className="mt-0.5 text-[11px] text-misdirected">{t.failureReason.replace(/_/g, ' ')}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={t.sourceSubAccount === 'OPS'
                      ? 'rounded-sm bg-gold-400/10 px-1.5 py-0.5 font-mono text-[11px] text-gold-600'
                      : 'rounded-sm bg-vault-50 px-1.5 py-0.5 font-mono text-[11px] text-vault-700'}>
                      {t.sourceSubAccount}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-sm tabular-nums text-ink">{formatNgn(t.amount)}</p>
                    {t.fee && (
                      <p className="font-mono text-[11px] text-ink-600/50">fee: {formatNgn(t.fee)}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs text-ink-600/60">{t.merchantTxRef}</p>
                    {t.nombaTransferId && (
                      <p className="font-mono text-[11px] text-ink-600/40">{t.nombaTransferId}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={t.status} /></td>
                  <td className="px-5 py-3.5 text-xs text-ink-600/50">{formatDateTime(t.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    {t.status === 'PENDING' && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setApproveTarget(t)}
                          className="flex items-center gap-1 rounded-sm border border-vault-300 bg-vault-50 px-2 py-1 text-xs font-medium text-vault-700 hover:bg-vault-100"
                          title="Approve"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectTarget(t)}
                          className="flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-misdirected hover:bg-red-100"
                          title="Reject"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {formOpen && (
        <TransferFormModal
          apps={apps ?? []}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['transfers'] })
            setFormOpen(false)
            toast.success('Transfer initiated — status: PENDING')
          }}
        />
      )}

      <ConfirmModal
        open={!!approveTarget}
        title="Approve this transfer?"
        description={`${formatNgn(approveTarget?.amount ?? '0')} will be sent to ${approveTarget?.destinationAccountName} (${approveTarget?.destinationBankCode} ${approveTarget?.destinationAccountNumber}).`}
        confirmLabel="Approve"
        tone="default"
        loading={approveMutation.isPending}
        onConfirm={() => approveTarget && approveMutation.mutate(approveTarget.id)}
        onClose={() => setApproveTarget(null)}
      />
      <ConfirmModal
        open={!!rejectTarget}
        title="Reject this transfer?"
        description={`The transfer of ${formatNgn(rejectTarget?.amount ?? '0')} to ${rejectTarget?.destinationAccountName} will be cancelled.`}
        confirmLabel="Reject transfer"
        tone="danger"
        loading={rejectMutation.isPending}
        onConfirm={() => rejectTarget && rejectMutation.mutate(rejectTarget.id)}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  )
}

function TransferFormModal({ apps, onClose, onCreated }: {
  apps: App[]
  onClose: () => void
  onCreated: () => void
}) {
  const [appId, setAppId] = useState(apps[0]?.id ?? '')
  const [customerId, setCustomerId] = useState('')
  const [sourceSubAccount, setSourceSubAccount] = useState<SubAccountType>('VAULT')
  const [amount, setAmount] = useState('')
  const [fee, setFee] = useState('')
  const [destinationAccountNumber, setDestinationAccountNumber] = useState('')
  const [destinationBankCode, setDestinationBankCode] = useState('')
  const [destinationAccountName, setDestinationAccountName] = useState('')
  const [narration, setNarration] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const valid = appId && customerId && amount && destinationAccountNumber && destinationBankCode && destinationAccountName

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    try {
      await initiateTransfer({
        appId, customerId, sourceSubAccount, amount, fee: fee || undefined,
        destinationAccountNumber, destinationBankCode, destinationAccountName,
        narration, merchantTxRef: `tx_${Math.random().toString(16).slice(2, 10)}`,
      })
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">New outbound transfer</h3>
          <button onClick={onClose} className="text-ink-600/40 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label>App</Label>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
              <SelectContent>{apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-customer">Customer ID *</Label>
            <Input id="t-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="cust_4b7d2e9f" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>Source sub-account</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['VAULT', 'OPS'] as SubAccountType[]).map((sa) => (
                <button key={sa} onClick={() => setSourceSubAccount(sa)}
                  className={sourceSubAccount === sa
                    ? 'rounded-sm border border-vault-500 bg-vault-50 px-3 py-2 text-left text-sm font-medium text-vault-700'
                    : 'rounded-sm border border-paper-200 px-3 py-2 text-left text-sm text-ink-600 hover:bg-paper-100'}>
                  {sa}
                  <span className="block text-[11px] font-normal text-ink-600/50">
                    {sa === 'VAULT' ? 'Customer funds' : 'Your revenue'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-amount">Amount (NGN) *</Label>
              <Input id="t-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-fee">Fee (NGN)</Label>
              <Input id="t-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Destination account name *</Label>
            <Input id="t-name" value={destinationAccountName} onChange={(e) => setDestinationAccountName(e.target.value)} placeholder="Ada Okonkwo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-acct">Account number *</Label>
              <Input id="t-acct" value={destinationAccountNumber} onChange={(e) => setDestinationAccountNumber(e.target.value)} placeholder="0123456789" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-bank">Bank code *</Label>
              <Input id="t-bank" value={destinationBankCode} onChange={(e) => setDestinationBankCode(e.target.value)} placeholder="058" className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-narr">Narration</Label>
            <Input id="t-narr" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Withdrawal request" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid || submitting} onClick={handleSubmit}>
            {submitting && <Spinner className="h-3.5 w-3.5 text-white" />}
            Initiate transfer
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Transfers() {
  return (
    <FeaturePage
      feature="MOCK_UI"
      comingSoon={{
        icon: ArrowUpRight,
        title: 'Outbound Transfers',
        description: 'Initiate customer withdrawals from VAULT and revenue payouts from OPS to external Nigerian bank accounts. Approve or reject pending transfers directly from the dashboard.',
        features: [
          'VAULT: customer withdrawal to any NUBAN',
          'OPS: revenue payout to your own bank account',
          'Approve / Reject pending transfers (JWT — dashboard only)',
          'Transfer status tracking (PENDING → SUBMITTED → COMPLETED)',
          'Fee tracking and Nomba transfer reference',
        ],
        eta: 'Phase 3 — NV-405 business logic',
      }}
    >
      <TransfersContent />
    </FeaturePage>
  )
}