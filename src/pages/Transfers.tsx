import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { ArrowUpRight, Plus, Info, X, RefreshCw, Lock, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { NoApiKey } from '@/components/shared/NoApiKey'
import { RequireApiKeyModal } from '@/components/shared/RequireApiKeyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getOutboundTransfers, initiateTransfer, initiateParentTransfer, approveTransfer, rejectTransfer, reconcileTransfer, getApps, getApiKeys, getFeeQuote, getBanks, lookupBankAccount } from '@/lib/api'
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
  const [approvePin, setApprovePin] = useState('')
  const [rejectTarget, setRejectTarget] = useState<OutboundTransfer | null>(null)
  const [rejectReason, setRejectReason] = useState('')
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
    mutationFn: (input: { id: string; pin?: string }) => approveTransfer(input.id, input.pin),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success(`Transfer approved — Nomba ref: ${data.nombaTransferId ?? 'pending'}`)
      setApproveTarget(null)
      setApprovePin('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Approval failed'),
  })

  const rejectMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) => rejectTransfer(input.id, input.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfer rejected')
      setRejectTarget(null)
      setRejectReason('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Rejection failed'),
  })

  const reconcileMutation = useMutation({
    mutationFn: reconcileTransfer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success(`Reconciliation result: ${data.status}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Reconciliation failed'),
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
            approval — use the Approve / Reject buttons to action them. Above-threshold transfers require a second approver
            and your transaction PIN.
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
                    <div className="flex justify-end gap-1.5">
                      {t.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => setApproveTarget(t)}
                            className="flex items-center gap-1 rounded-sm border border-vault-300 bg-vault-50 px-2 py-1 text-xs font-medium text-vault-700 hover:bg-vault-100"
                            title="Approve (requires transaction PIN)"
                          >
                            <Lock className="h-3 w-3" /> Approve
                          </button>
                          <button
                            onClick={() => setRejectTarget(t)}
                            className="flex items-center gap-1 rounded-sm border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-misdirected hover:bg-red-100"
                            title="Reject"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      {t.status === 'SUBMITTED' && (
                        <button
                          onClick={() => reconcileMutation.mutate(t.id)}
                          disabled={reconcileMutation.isPending}
                          className="flex items-center gap-1 rounded-sm border border-paper-300 bg-paper-100 px-2 py-1 text-xs font-medium text-ink-600 hover:bg-paper-200"
                          title="Reconcile settlement (poll Nomba)"
                        >
                          <RefreshCw className={`h-3 w-3 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} /> Reconcile
                        </button>
                      )}
                    </div>
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

      {/* Approve modal with PIN input */}
      {approveTarget && (
        <ApproveWithPinModal
          transfer={approveTarget}
          pin={approvePin}
          onPinChange={setApprovePin}
          loading={approveMutation.isPending}
          onConfirm={() => {
            if (!approveTarget) return
            approveMutation.mutate({
              id: approveTarget.id,
              pin: approvePin || undefined,
            })
          }}
          onClose={() => {
            setApproveTarget(null)
            setApprovePin('')
          }}
        />
      )}

      {/* Reject modal with reason input */}
      {rejectTarget && (
        <RejectWithReasonModal
          transfer={rejectTarget}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          loading={rejectMutation.isPending}
          onConfirm={() => {
            if (!rejectTarget) return
            rejectMutation.mutate({
              id: rejectTarget.id,
              reason: rejectReason || 'Rejected via dashboard',
            })
          }}
          onClose={() => {
            setRejectTarget(null)
            setRejectReason('')
          }}
        />
      )}
    </div>
  )
}

function ApproveWithPinModal({ transfer, pin, onPinChange, loading, onConfirm, onClose }: {
  transfer: OutboundTransfer
  pin: string
  onPinChange: (v: string) => void
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vault-50 text-vault-600">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Approve transfer</h3>
            <p className="text-xs text-ink-600/60">
              {formatNgn(transfer.amount)} → {transfer.destinationAccountName}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-sm border border-paper-200 bg-paper-100 px-3 py-2 text-xs text-ink-600">
            <p>This action requires your transaction PIN. If you haven't set one, go to Settings first.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approve-pin">Transaction PIN</Label>
            <Input
              id="approve-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="font-mono text-center text-lg tracking-[0.5em]"
              autoFocus
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={loading} onClick={onConfirm}>
            {loading && <Spinner className="h-3.5 w-3.5 text-white" />}
            Approve & release
          </Button>
        </div>
      </div>
    </div>
  )
}

function RejectWithReasonModal({ transfer, reason, onReasonChange, loading, onConfirm, onClose }: {
  transfer: OutboundTransfer
  reason: string
  onReasonChange: (v: string) => void
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-misdirected">
            <X className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Reject transfer</h3>
            <p className="text-xs text-ink-600/60">
              {formatNgn(transfer.amount)} → {transfer.destinationAccountName}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input
              id="reject-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Wrong beneficiary, duplicate request"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading && <Spinner className="h-3.5 w-3.5 text-white" />}
            Reject transfer
          </Button>
        </div>
      </div>
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
  const [useParentAccount, setUseParentAccount] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feeQuoteEnabled, setFeeQuoteEnabled] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false)
  const [resolving, setResolving] = useState(false)

  const valid = appId && customerId && amount && destinationAccountNumber && destinationBankCode && destinationAccountName

  const { data: banks } = useQuery({
    queryKey: ['banks'],
    queryFn: getBanks,
    staleTime: 300_000,
  })

  // Auto-quote fee when amount changes (debounced)
  const { data: feeQuote, isFetching: feeQuoteLoading } = useQuery({
    queryKey: ['fee-quote', 'OUTBOUND', amount],
    queryFn: () => getFeeQuote('OUTBOUND', amount),
    enabled: !!amount && parseFloat(amount) > 0 && feeQuoteEnabled,
    staleTime: 30_000,
  })

  const filteredBanks = (banks ?? []).filter((b) =>
    !bankSearch || b.bankName.toLowerCase().includes(bankSearch.toLowerCase()) || b.bankCode.includes(bankSearch)
  )

  // Auto-resolve account name when account number + bank code are set
  async function handleAccountNumberBlur() {
    if (!destinationAccountNumber || !destinationBankCode || destinationAccountName) return
    setResolving(true)
    try {
      const result = await lookupBankAccount({ accountNumber: destinationAccountNumber, bankCode: destinationBankCode })
      if (result.accountName) setDestinationAccountName(result.accountName)
    } catch {
      // Silently fail — user can type the name manually
    } finally {
      setResolving(false)
    }
  }

  // Close bank dropdown on outside click
  useEffect(() => {
    if (!bankDropdownOpen) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-bank-dropdown]')) setBankDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [bankDropdownOpen])

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    const payload = {
      appId, customerId, sourceSubAccount, amount,
      // Use quoted fee if available, otherwise fall back to manual input
      fee: feeQuote ? feeQuote.fee : (fee || undefined),
      destinationAccountNumber, destinationBankCode, destinationAccountName,
      narration, merchantTxRef: `tx_${Math.random().toString(16).slice(2, 10)}`,
    }
    try {
      if (useParentAccount) {
        await initiateParentTransfer(payload)
      } else {
        await initiateTransfer(payload)
      }
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

          {/* Transfer route selector */}
          <div className="space-y-1.5">
            <Label>Transfer route</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseParentAccount(false)}
                className={`rounded-sm border px-3 py-2 text-left text-sm ${
                  !useParentAccount
                    ? 'border-vault-500 bg-vault-50 font-medium text-vault-700'
                    : 'border-paper-200 text-ink-600 hover:bg-paper-100'
                }`}
              >
                Sub-account
                <span className="block text-[11px] font-normal text-ink-600/50">Merchant VAULT pool</span>
              </button>
              <button
                type="button"
                onClick={() => setUseParentAccount(true)}
                className={`rounded-sm border px-3 py-2 text-left text-sm ${
                  useParentAccount
                    ? 'border-gold-500 bg-gold-400/10 font-medium text-gold-700'
                    : 'border-paper-200 text-ink-600 hover:bg-paper-100'
                }`}
              >
                Parent account
                <span className="block text-[11px] font-normal text-ink-600/50">Platform parent pool</span>
              </button>
            </div>
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
              <Input id="t-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setFeeQuoteEnabled(true) }} placeholder="50000.00" />
              {feeQuote && !feeQuoteLoading && (
                <p className="text-[11px] text-vault-600">
                  Fee preview: <span className="font-mono">{formatNgn(feeQuote.fee)}</span>
                  {' · '}Net: <span className="font-mono">{formatNgn(feeQuote.netAmount)}</span> will leave wallet
                </p>
              )}
              {feeQuoteLoading && (
                <p className="text-[11px] text-ink-600/50">Quoting fee…</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-fee">Fee (NGN)</Label>
              <div className="relative">
                <Input id="t-fee" inputMode="decimal" value={feeQuote ? feeQuote.fee : fee} onChange={(e) => { setFee(e.target.value); setFeeQuoteEnabled(false) }} placeholder={feeQuote ? `Auto: ${formatNgn(feeQuote.fee)}` : 'Optional'} disabled={!!feeQuote} />
                {!feeQuote && (
                  <button
                    type="button"
                    onClick={() => setFeeQuoteEnabled(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-600/40 hover:text-vault-600"
                    title="Auto-quote fee"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {feeQuote && (
                <p className="text-[11px] text-ink-600/50">
                  Auto-quoted from Meroe schedule. <button type="button" onClick={() => { setFeeQuoteEnabled(false); setFee('') }} className="underline hover:text-ink">Manual</button>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Destination account name *</Label>
            <Input id="t-name" value={destinationAccountName} onChange={(e) => setDestinationAccountName(e.target.value)} placeholder={resolving ? 'Resolving…' : 'Ada Okonkwo'} disabled={resolving} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-acct">Account number *</Label>
              <Input id="t-acct" value={destinationAccountNumber} onChange={(e) => setDestinationAccountNumber(e.target.value)} onBlur={handleAccountNumberBlur} placeholder="0123456789" className="font-mono" />
            </div>
            <div className="space-y-1.5 relative" data-bank-dropdown>
              <Label>Bank code *</Label>
              <div className="relative">
                <Input
                  value={bankSearch || (destinationBankCode ? (banks ?? []).find((b) => b.bankCode === destinationBankCode)?.bankName ?? destinationBankCode : '')}
                  onChange={(e) => { setBankSearch(e.target.value); setBankDropdownOpen(true); setDestinationBankCode('') }}
                  onFocus={() => setBankDropdownOpen(true)}
                  placeholder="Search bank…"
                />
                {bankDropdownOpen && filteredBanks.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-sm border border-paper-200 bg-white shadow-lg">
                    {filteredBanks.slice(0, 20).map((b) => (
                      <button
                        key={b.bankCode}
                        type="button"
                        onClick={() => { setDestinationBankCode(b.bankCode); setBankSearch(''); setBankDropdownOpen(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-paper-100"
                      >
                        <code className="font-mono text-ink-600/60">{b.bankCode}</code>
                        <span className="text-ink">{b.bankName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!destinationBankCode && <p className="text-[11px] text-ink-600/50">Type to search by name or code</p>}
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
            {useParentAccount ? 'Initiate (parent pool)' : 'Initiate transfer'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Transfers() {
  return <TransfersContent />
}