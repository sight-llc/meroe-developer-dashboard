import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { ArrowLeft, FileDown, FileSpreadsheet, ChevronDown, FileCheck } from 'lucide-react'
import { toast } from 'sonner'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CopyButton } from '@/components/shared/CopyButton'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Spinner } from '@/components/shared/PageHeader'
import { NoApiKey } from '@/components/shared/NoApiKey'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { activeKeyStore } from '@/lib/active-key-store'
import {
  getCustomer, getCustomerBalance, getCustomerTransactions, downloadStatement,
  suspendCustomer, reactivateCustomer, closeCustomer, renameCustomer, changeKycTier,
  submitCustomerKycDocuments,
} from '@/lib/api'
import { formatNgn, formatDateTime, formatDate } from '@/lib/utils'
import type { Customer, TransactionPage, BalanceState, KycTier } from '@/types'

type LifecycleAction = 'suspend' | 'reactivate' | 'close' | null

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)
  const [actionPending, setActionPending] = useState<LifecycleAction>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [kycOpen, setKycOpen] = useState(false)
  const [kycBvn, setKycBvn] = useState('')
  const [kycDocRefs, setKycDocRefs] = useState('')

  const hasActiveKey = !!activeKeyStore.get()

  const { data: customer, isLoading: custLoading, error: custError, refetch: custRefetch } = useQuery<Customer | undefined>({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id && hasActiveKey,
  })

  const { data: balance, isLoading: balLoading, error: balError, refetch: balRefetch } = useQuery<BalanceState>({
    queryKey: ['customer-balance', id],
    queryFn: () => getCustomerBalance(id!),
    enabled: !!id && hasActiveKey,
  })

  const { data: txPage, isLoading: txLoading, error: txError, refetch: txRefetch } = useQuery<TransactionPage>({
    queryKey: ['customer-transactions', id],
    queryFn: () => getCustomerTransactions(id!),
    enabled: !!id && hasActiveKey,
  })

  const suspendMutation = useMutation({
    mutationFn: () => suspendCustomer(id!, 'Manual action from dashboard'),
    onSuccess: (data) => {
      queryClient.setQueryData(['customer', id], data)
      toast.success('Account suspended')
      setActionPending(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateCustomer(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(['customer', id], data)
      toast.success('Account reactivated')
      setActionPending(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeCustomer(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(['customer', id], data)
      toast.success('Account closed')
      setActionPending(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action failed'),
  })

  const kycMutation = useMutation({
    mutationFn: () => {
      const documentReferences = kycDocRefs.split(',').map((r) => r.trim()).filter(Boolean)
      return submitCustomerKycDocuments(id!, {
        bvn: kycBvn || undefined,
        documentReferences,
      })
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['customer', id], data)
      toast.success('KYC documents submitted for review')
      setKycOpen(false)
      setKycBvn('')
      setKycDocRefs('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'KYC submission failed'),
  })

  async function handleDownload(format: 'pdf' | 'csv') {
    if (!id) return
    setDownloading(format)
    const tid = toast.loading(`Preparing ${format.toUpperCase()} statement…`)
    try {
      const { blob, filename } = await downloadStatement(id, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${filename} downloaded`, { id: tid })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed', { id: tid })
    } finally {
      setDownloading(null)
    }
  }

  const pageLoading = custLoading
  const pageError = custError

  if (!hasActiveKey) {
    return (
      <div>
        <button onClick={() => navigate('/customers')} className="mb-4 flex items-center gap-1.5 text-sm text-ink-600/70 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Customers
        </button>
        <NoApiKey />
      </div>
    )
  }

  if (pageLoading || pageError) {
    return (
      <div>
        <button onClick={() => navigate('/customers')} className="mb-4 flex items-center gap-1.5 text-sm text-ink-600/70 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Customers
        </button>
        <ApiStateDisplay loading={pageLoading} error={pageError?.message ?? null} retry={custRefetch} />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="py-16 text-center text-sm text-ink-600/70">
        Customer not found.{' '}
        <button onClick={() => navigate('/customers')} className="text-vault-600 hover:underline">Back to customers</button>
      </div>
    )
  }

  const canSuspend = customer.accountStatus === 'ACTIVE'
  const canReactivate = customer.accountStatus === 'SUSPENDED'
  const canClose = customer.accountStatus !== 'CLOSED'

  const lifecycleBusy = suspendMutation.isPending || reactivateMutation.isPending || closeMutation.isPending

  return (
    <div>
      <button onClick={() => navigate('/customers')} className="mb-4 flex items-center gap-1.5 text-sm text-ink-600/70 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Customers
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">{customer.fullName}</h1>
          <p className="mt-1 text-sm text-ink-600/60">
            {customer.email}
            {customer.phone && <span className="text-ink-600/40"> · {customer.phone}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-sm bg-paper-100 px-2 py-1 font-mono text-xs text-ink-600">
              {customer.nuban} · {customer.bankName}
            </code>
            <CopyButton value={customer.nuban} />
            <StatusBadge status={customer.accountStatus} />
            <span className="text-xs text-ink-600/40">VA:</span>
            <StatusBadge status={customer.virtualAccount.status} />
            <span className="text-xs text-ink-600/50">{customer.kycTier.replace('_', ' ')}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-600/50">
            <span><span className="text-ink-600/30">ref:</span> <code className="font-mono">{customer.externalRef}</code></span>
            {customer.bvnMasked && <span><span className="text-ink-600/30">BVN:</span> <code className="font-mono">{customer.bvnMasked}</code></span>}
            <span>Created {formatDate(customer.createdAt)}</span>
          </div>
        </div>

        {/* Actions + download */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'} className="flex items-center gap-1.5 rounded-sm border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-paper-100 disabled:opacity-60">
            <FileDown className="h-3.5 w-3.5" />{downloading === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
          <button onClick={() => handleDownload('csv')} disabled={downloading === 'csv'} className="flex items-center gap-1.5 rounded-sm border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-paper-100 disabled:opacity-60">
            <FileSpreadsheet className="h-3.5 w-3.5" />{downloading === 'csv' ? 'Preparing…' : 'CSV'}
          </button>
          <button onClick={() => setKycOpen(!kycOpen)} className="flex items-center gap-1.5 rounded-sm border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-paper-100">
            <FileCheck className="h-3.5 w-3.5" /> Submit KYC
          </button>

          {/* Lifecycle actions dropdown */}
          <div className="relative">
            <button onClick={() => setActionsOpen((v) => !v)} className="flex items-center gap-1.5 rounded-sm border border-paper-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-paper-100">
              Actions <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-sm border border-paper-200 bg-white shadow-lg">
                {canSuspend && (
                  <button onClick={() => { setActionPending('suspend'); setActionsOpen(false) }} className="flex w-full px-3 py-2 text-left text-sm text-gold-600 hover:bg-paper-100">
                    Suspend account
                  </button>
                )}
                {canReactivate && (
                  <button onClick={() => { setActionPending('reactivate'); setActionsOpen(false) }} className="flex w-full px-3 py-2 text-left text-sm text-vault-600 hover:bg-paper-100">
                    Reactivate account
                  </button>
                )}
                {canClose && (
                  <button onClick={() => { setActionPending('close'); setActionsOpen(false) }} className="flex w-full px-3 py-2 text-left text-sm text-misdirected hover:bg-red-50">
                    Close account
                  </button>
                )}
                {!canSuspend && !canReactivate && !canClose && (
                  <p className="px-3 py-2 text-xs text-ink-600/50">No actions available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance */}
      <Card className="panel !p-5">
        <p className="label-eyebrow">Balance</p>
        {balLoading ? (
          <div className="flex h-20 items-center justify-center"><Spinner className="h-5 w-5" /></div>
        ) : balError ? (
          <ApiStateDisplay loading={false} error={balError?.message ?? null} retry={balRefetch} />
        ) : balance ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-sm bg-paper-100 p-4">
              <p className="font-mono text-[11px] text-ink-600/50">available</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-ink">
                {formatNgn(balance.available)}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-600/40">confirmed wallet balance</p>
            </div>
            <div className="rounded-sm bg-vault-50 p-4">
              <p className="font-mono text-[11px] text-vault-600">spendable</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-vault-700">
                {formatNgn(balance.spendable)}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-600/40">available − inflight_debit</p>
            </div>
            <div className="rounded-sm bg-paper-100 p-4">
              <p className="font-mono text-[11px] text-ink-600/50">inflight_debit</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-gold-600">
                {formatNgn(balance.inflightDebit)}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-600/40 uppercase">{balance.currency} · pending outbound</p>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Transactions */}
        <Card className="panel !p-0 lg:col-span-2">
          <div className="border-b border-paper-200 px-5 py-3">
            <p className="label-eyebrow">Transactions</p>
          </div>
          {txLoading ? (
            <div className="flex h-32 items-center justify-center"><Spinner className="h-5 w-5" /></div>
          ) : txError ? (
            <ApiStateDisplay loading={false} error={txError?.message ?? null} retry={txRefetch} />
          ) : (txPage?.content ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-600/60">No transactions yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                    <th className="px-5 py-2.5 font-medium">Reference</th>
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-5 py-2.5 font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Balance after</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-200">
                  {(txPage?.content ?? []).map((tx) => (
                    <tr key={tx.transactionId}>
                      <td className="px-5 py-3 font-mono text-xs text-ink-600">{tx.reference}</td>
                      <td className="px-5 py-3 text-xs text-ink-600/70">{tx.type.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3">
                        <span className={tx.direction === 'CREDIT' ? 'font-mono text-sm font-medium text-vault-600' : 'font-mono text-sm font-medium text-ink-600'}>
                          {tx.direction === 'CREDIT' ? '+' : '−'}{formatNgn(tx.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs tabular-nums text-ink-600/60">
                        {formatNgn(tx.balanceAfter)}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-5 py-3 text-xs text-ink-600/50">{formatDateTime(tx.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txPage && txPage.totalPages > 1 && (
                <div className="border-t border-paper-200 px-5 py-3 text-xs text-ink-600/50">
                  Page {txPage.page + 1} of {txPage.totalPages} · {txPage.totalElements} total
                </div>
              )}
            </>
          )}
        </Card>

        {/* Events timeline */}
        <Card className="panel !p-5">
          <p className="label-eyebrow">Account events</p>
          {customer.events.length === 0 ? (
            <p className="mt-3 text-sm text-ink-600/50">No events recorded.</p>
          ) : (
            <ol className="mt-3 space-y-4 border-l border-paper-200 pl-4">
              {customer.events.map((evt) => (
                <li key={evt.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-vault-500" />
                  <p className="text-sm font-medium text-ink">{evt.type.replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-[11px] text-ink-600/50">{formatDateTime(evt.createdAt)}</p>
                  <pre className="mt-1.5 overflow-x-auto rounded-sm bg-paper-100 p-2 font-mono text-[10px] text-ink-600">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* KYC document submission form */}
      {kycOpen && (
        <Card className="panel !p-5 mt-5">
          <p className="label-eyebrow">Submit KYC Documents</p>
          <p className="mt-1 text-sm text-ink-600/70">Submit BVN and document references for KYC review.</p>
          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="kyc-bvn">BVN (optional, 11 digits)</Label>
              <Input id="kyc-bvn" value={kycBvn} onChange={(e) => setKycBvn(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="00123456789" className="font-mono" maxLength={11} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kyc-refs">Document references (comma-separated)</Label>
              <Input id="kyc-refs" value={kycDocRefs} onChange={(e) => setKycDocRefs(e.target.value)} placeholder="doc_passport_9f2, doc_utility_bill_1a7" className="font-mono text-xs" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={kycMutation.isPending || (!kycBvn && !kycDocRefs.trim())} onClick={() => kycMutation.mutate()}>
                {kycMutation.isPending && <Spinner className="h-3.5 w-3.5 text-white" />}
                Submit for review
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setKycOpen(false); setKycBvn(''); setKycDocRefs('') }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lifecycle confirm modals */}
      <ConfirmModal
        open={actionPending === 'suspend'}
        title="Suspend this account?"
        description="The customer's virtual account will stop accepting payments. You can reactivate it later."
        confirmLabel="Suspend"
        tone="danger"
        loading={lifecycleBusy}
        onConfirm={() => suspendMutation.mutate()}
        onClose={() => setActionPending(null)}
      />
      <ConfirmModal
        open={actionPending === 'reactivate'}
        title="Reactivate this account?"
        description="The customer's virtual account will resume accepting payments immediately."
        confirmLabel="Reactivate"
        tone="default"
        loading={lifecycleBusy}
        onConfirm={() => reactivateMutation.mutate()}
        onClose={() => setActionPending(null)}
      />
      <ConfirmModal
        open={actionPending === 'close'}
        title="Close this account? This cannot be undone."
        description="The virtual account is permanently decommissioned. Any inbound payments will be returned. This action is irreversible."
        confirmLabel="Close account"
        tone="danger"
        loading={lifecycleBusy}
        onConfirm={() => closeMutation.mutate()}
        onClose={() => setActionPending(null)}
      />
    </div>
  )
}