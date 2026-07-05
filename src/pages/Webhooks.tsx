import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { Webhook as WebhookIcon, Plus, Zap, Trash2, X, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { MockBadge } from '@/components/shared/MockBadge'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/shared/CopyButton'
import {
  getWebhookSubscriptions,
  createWebhookSubscription,
  testWebhookSubscription,
  deleteWebhookSubscription,
  getWebhookDeliveries,
} from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { WebhookDelivery, WebhookSubscription, WebhookSubscriptionCreated } from '@/types'

// Real Nomba event type catalog — matches backend EventType enum
const NOMBA_EVENT_TYPES = [
  { value: 'INBOUND_PAYMENT', label: 'Inbound payment', hint: 'Payment received into a virtual account' },
  { value: 'TRANSFER_SETTLEMENT', label: 'Transfer settled', hint: 'Outbound transfer successfully processed' },
  { value: 'TRANSFER_FAILED', label: 'Transfer failed', hint: 'Outbound transfer could not be processed' },
  { value: 'CUSTOMER_CLOSED', label: 'Customer closed', hint: 'Virtual account permanently closed' },
  { value: 'KYC_LIMIT_BREACH', label: 'KYC limit breach', hint: 'Transaction exceeded the customer\'s KYC tier limit' },
  { value: 'ACCOUNT_SUSPENDED', label: 'Account suspended', hint: 'Virtual account was suspended' },
  { value: 'ACCOUNT_REACTIVATED', label: 'Account reactivated', hint: 'Suspended account was reactivated' },
]

export default function Webhooks() {
  const queryClient = useQueryClient()
  const { data: subs, isLoading, error, refetch } = useQuery<WebhookSubscription[]>({
    queryKey: ['webhook-subscriptions'],
    queryFn: getWebhookSubscriptions,
  })
  const [addOpen, setAddOpen] = useState(false)
  const [logsFor, setLogsFor] = useState<WebhookSubscription | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookSubscription | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [revealSub, setRevealSub] = useState<WebhookSubscriptionCreated | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteWebhookSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-subscriptions'] })
      toast.success('Subscription deleted')
      setDeleteTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  })

  async function handleTest(id: string) {
    setTestingId(id)
    const tid = toast.loading('Firing test event…')
    try {
      await testWebhookSubscription(id)
      toast.success('Test event delivered', { id: tid })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed', { id: tid })
    } finally {
      setTestingId(null)
    }
  }

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader
        eyebrow="Notifications"
        title="Webhooks"
        description="Subscribe your endpoints to Nomba events. Note: event delivery (outbox worker) is in progress — subscriptions can be created and managed now."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add endpoint
          </Button>
        }
      />

      <Card className="panel !p-0">
        {(subs ?? []).length === 0 ? (
          <EmptyState icon={WebhookIcon} title="No webhook endpoints" description="Add an endpoint to receive real-time events once delivery is enabled." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                <th className="px-5 py-3 font-medium">Endpoint</th>
                <th className="px-5 py-3 font-medium">Events</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {(subs ?? []).map((sub) => (
                <tr key={sub.id}>
                  <td className="px-5 py-3.5">
                    <p className="max-w-xs truncate font-mono text-xs text-ink">{sub.url}</p>
                    <p className="mt-0.5 text-[11px] text-ink-600/50">{sub.environment}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {sub.eventTypes.slice(0, 2).map((et) => (
                        <span key={et} className="rounded-sm bg-paper-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-600">
                          {et}
                        </span>
                      ))}
                      {sub.eventTypes.length > 2 && (
                        <span className="text-[11px] text-ink-600/50">+{sub.eventTypes.length - 2} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={sub.status} /></td>
                  <td className="px-5 py-3.5 text-xs text-ink-600/60">{formatDate(sub.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleTest(sub.id)}
                        disabled={testingId === sub.id}
                        className="flex items-center gap-1 rounded-sm border border-paper-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-paper-100"
                      >
                        {testingId === sub.id ? <Spinner className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                        Test
                      </button>
                      <button
                        onClick={() => setLogsFor(sub)}
                        className="rounded-sm border border-paper-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-paper-100"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="rounded-sm p-1.5 text-ink-600/50 hover:bg-red-50 hover:text-misdirected"
                        title="Delete subscription"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {addOpen && (
        <AddWebhookModal
          onClose={() => setAddOpen(false)}
          onCreated={(created) => {
            queryClient.invalidateQueries({ queryKey: ['webhook-subscriptions'] })
            setAddOpen(false)
            setRevealSub(created)
          }}
        />
      )}

      {revealSub && (
        <SecretRevealModal subscription={revealSub} onClose={() => setRevealSub(null)} />
      )}

      {logsFor && (
        <DeliveryLogsDrawer subscription={logsFor} onClose={() => setLogsFor(null)} />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this webhook subscription?"
        description={`Your endpoint at ${deleteTarget?.url} will stop receiving events immediately.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function AddWebhookModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (created: WebhookSubscriptionCreated) => void
}) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  function toggle(value: string) {
    setEvents((prev) => (prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]))
  }

  async function handleSubmit() {
    if (!url || events.length === 0) return
    setSubmitting(true)
    const tid = toast.loading('Adding endpoint…')
    try {
      const created = await createWebhookSubscription({ url, eventTypes: events })
      toast.success('Endpoint added — copy your signing secret', { id: tid })
      onCreated(created)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add endpoint', { id: tid })
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Add webhook endpoint</h3>
          <button onClick={onClose} className="text-ink-600/40 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label-eyebrow">Callback URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.yourapp.com/webhooks/meroe"
              className="mt-1.5 w-full rounded-sm border border-paper-200 px-3 py-2 font-mono text-xs outline-none focus:border-vault-500 focus:ring-1 focus:ring-vault-500"
            />
          </div>
          <div>
            <label className="label-eyebrow">Event types</label>
            <div className="mt-1.5 space-y-1.5 max-h-56 overflow-y-auto rounded-sm border border-paper-200 p-2.5">
              {NOMBA_EVENT_TYPES.map((et) => (
                <label key={et.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(et.value)}
                    onChange={() => toggle(et.value)}
                    className="mt-0.5 h-3.5 w-3.5 rounded-sm accent-vault-600"
                  />
                  <span>
                    <span className="block font-mono text-xs text-ink">{et.value}</span>
                    <span className="block text-[11px] text-ink-600/50">{et.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!url || events.length === 0 || submitting} onClick={handleSubmit}>
            {submitting && <Spinner className="h-3.5 w-3.5 text-white" />}
            Add endpoint
          </Button>
        </div>
      </div>
    </div>
  )
}

function SecretRevealModal({ subscription, onClose }: { subscription: WebhookSubscriptionCreated; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/10 text-gold-600">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-ink">Copy your signing secret</h3>
        </div>
        <p className="mt-3 text-sm text-ink-600/80">
          {subscription.warning || 'This secret is shown once only. Use it to verify HMAC signatures on incoming webhook payloads.'}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-sm border border-gold-400/40 bg-gold-400/10 px-3 py-2.5">
          <code className="truncate font-mono text-xs text-ink">{subscription.secret}</code>
          <CopyButton value={subscription.secret} />
        </div>
        <p className="mt-2 text-[11px] text-ink-600/50">Endpoint: <code className="font-mono">{subscription.url}</code></p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}

function DeliveryLogsDrawer({ subscription, onClose }: { subscription: WebhookSubscription; onClose: () => void }) {
  const { data: deliveries, isLoading, error, refetch } = useQuery<WebhookDelivery[]>({
    queryKey: ['webhook-deliveries', subscription.id],
    queryFn: () => getWebhookDeliveries(subscription.id),
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-eyebrow">Delivery logs</p>
            <p className="mt-1 max-w-[280px] truncate font-mono text-xs text-ink-600">{subscription.url}</p>
          </div>
          <button onClick={onClose} className="text-ink-600/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4">
          <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
          {!isLoading && !error && (deliveries ?? []).length === 0 && (
            <div className="py-8 text-center text-sm text-ink-600/50">No deliveries yet — outbox worker (NV-404) in progress.</div>
          )}
          {!isLoading && !error && (deliveries ?? []).length > 0 && (
            <ul className="space-y-2">
              {(deliveries ?? []).map((d) => (
                <li key={d.id} className="rounded-sm border border-paper-200 p-3">
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-xs text-ink">{d.eventType}</code>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-600/60">
                    <span>{formatDateTime(d.createdAt)}</span>
                    <span>
                      {d.attempts} attempt{d.attempts > 1 ? 's' : ''}
                      {d.responseCode != null ? ` · ${d.responseCode}` : ''}
                      {d.latencyMs != null ? ` · ${d.latencyMs}ms` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}