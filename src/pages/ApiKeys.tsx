import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { KeyRound, Plus, RefreshCcw, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { CopyButton } from '@/components/shared/CopyButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getApiKeys, createApiKey, revokeApiKey, rollApiKey, getApps } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { formatDate } from '@/lib/utils'
import type { ApiKey, ApiKeyCreated, ApiScope, App } from '@/types'
import { SetActiveKeyModal } from '@/components/shared/SetActiveKeyModal'

// Only the two scopes confirmed working in the backend; others listed but gated
const CONFIRMED_SCOPES: { scope: ApiScope; confirmed: boolean }[] = [
  { scope: 'customers:read', confirmed: true },
  { scope: 'customers:write', confirmed: true },
  { scope: 'transactions:read', confirmed: false },
  { scope: 'transfers:read', confirmed: false },
  { scope: 'transfers:write', confirmed: false },
  { scope: 'accounts:read', confirmed: false },
  { scope: 'accounts:write', confirmed: false },
  { scope: 'reconciliation:read', confirmed: false },
  { scope: 'reconciliation:write', confirmed: false },
  { scope: 'webhooks:manage', confirmed: false },
  { scope: 'reports:read', confirmed: false },
]

export default function ApiKeys() {
  const queryClient = useQueryClient()
  const [appFilter, setAppFilter] = useState('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [revealKey, setRevealKey] = useState<ApiKeyCreated | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; action: 'revoke' | 'roll' } | null>(null)
  const [setKeyModal, setSetKeyModal] = useState<ApiKey | null>(null)

  const { data: apps } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: getApps,
  })

  const { data: keys, isLoading, error, refetch } = useQuery<ApiKey[]>({
    queryKey: ['api-keys', appFilter],
    queryFn: () => getApiKeys(appFilter === 'ALL' ? undefined : appFilter),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('Key revoked')
      setConfirmTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to revoke key'),
  })

  const rollMutation = useMutation({
    mutationFn: rollApiKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setRevealKey(data)
      toast.success('Key rolled — copy your new key now')
      setConfirmTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to roll key'),
  })

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader
        eyebrow="Authentication"
        title="API Keys"
        description="Server-to-server keys scoped to an app. Keys belong to the app's environment."
        action={
          <Button onClick={() => setCreateOpen(true)} disabled={(apps ?? []).length === 0}>
            <Plus className="h-4 w-4" /> Create key
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={appFilter} onValueChange={setAppFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All apps" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All apps</SelectItem>
            {(apps ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="panel !p-0">
        {(keys ?? []).length === 0 ? (
          <EmptyState icon={KeyRound} title="No API keys" description={(apps ?? []).length === 0 ? 'Create an app first.' : 'Create a key to start calling the Meroe API.'} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                <th className="px-5 py-3 font-medium">App</th>
                <th className="px-5 py-3 font-medium">Key</th>
                <th className="px-5 py-3 font-medium">Env</th>
                <th className="px-5 py-3 font-medium">Scopes</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {(keys ?? []).map((key) => (
                <tr key={key.id}>
                  <td className="px-5 py-3.5">
                    <span className="rounded-sm bg-paper-100 px-1.5 py-0.5 text-xs text-ink-600">
                      {key.appName ?? (apps ?? []).find((a) => a.id === key.appId)?.name ?? key.appId}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="font-mono text-xs text-ink-600">
                      {key.keyPrefix}
                      <span className="text-ink-600/40">••••</span>
                      {key.lastFour}
                    </code>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={key.environment === 'live' ? 'font-mono text-xs text-gold-600' : 'font-mono text-xs text-ink-600/60'}>
                      {key.environment}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-600/70">{key.scopes.length} scopes</td>
                  <td className="px-5 py-3.5 text-xs text-ink-600/60">{formatDate(key.createdAt)}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={key.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      {key.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => setSetKeyModal(key)}
                            className="rounded-sm p-1.5 text-ink-600/60 hover:bg-paper-100 hover:text-ink"
                            title="Set as active"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmTarget({ id: key.id, action: 'roll' })} className="rounded-sm p-1.5 text-ink-600/60 hover:bg-paper-100 hover:text-ink" title="Roll key">
                            <RefreshCcw className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmTarget({ id: key.id, action: 'revoke' })} className="rounded-sm p-1.5 text-ink-600/60 hover:bg-red-50 hover:text-misdirected" title="Revoke key">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {createOpen && (
        <CreateKeyModal
          apps={(apps ?? []).filter((a) => a.status === 'ACTIVE')}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            queryClient.invalidateQueries({ queryKey: ['api-keys'] })
            // Auto-set as active key
            const app = (apps ?? []).find((a) => a.id === created.appId)
            activeKeyStore.set({
              rawKey: created.rawKey,
              keyPrefix: created.keyPrefix,
              lastFour: created.lastFour,
              appName: app?.name,
              appId: created.appId,
              environment: created.environment,
            })
            setCreateOpen(false)
            setRevealKey(created)
          }}
        />
      )}

      {revealKey && <RevealKeyModal apiKey={revealKey} onClose={() => setRevealKey(null)} />}

      <ConfirmModal
        open={!!confirmTarget}
        title={confirmTarget?.action === 'revoke' ? 'Revoke this key?' : 'Roll this key?'}
        description={confirmTarget?.action === 'revoke' ? 'This key stops working immediately — any server using it will get 401s.' : 'A new key is generated now. The old key keeps working for 24 hours, then expires.'}
        confirmLabel={confirmTarget?.action === 'revoke' ? 'Revoke key' : 'Roll key'}
        tone={confirmTarget?.action === 'revoke' ? 'danger' : 'default'}
        loading={revokeMutation.isPending || rollMutation.isPending}
        onConfirm={() => {
          if (!confirmTarget) return
          if (confirmTarget.action === 'revoke') revokeMutation.mutate(confirmTarget.id)
          else rollMutation.mutate(confirmTarget.id)
        }}
        onClose={() => setConfirmTarget(null)}
      />

       {setKeyModal && (
         <SetActiveKeyModal
           apiKey={setKeyModal}
           allApiKeys={keys ?? []}
           onClose={() => setSetKeyModal(null)}
           onSuccess={() => setSetKeyModal(null)}
         />
       )}
    </div>
  )
}

function CreateKeyModal({ apps, onClose, onCreated }: { apps: App[]; onClose: () => void; onCreated: (k: ApiKeyCreated) => void }) {
  const [appId, setAppId] = useState(apps[0]?.id ?? '')
  const [scopes, setScopes] = useState<ApiScope[]>(['customers:read'])
  const [submitting, setSubmitting] = useState(false)

  function toggleScope(scope: ApiScope) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]))
  }

  async function handleSubmit() {
    if (!appId || scopes.length === 0) return
    setSubmitting(true)
    const tid = toast.loading('Creating key…')
    try {
      const created = await createApiKey({ appId, scopes })
      toast.success('Key created — copy it now', { id: tid })
      onCreated(created)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create key', { id: tid })
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-ink">Create API key</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>App</Label>
            <Select value={appId} onValueChange={setAppId}>
              <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
              <SelectContent>{apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scopes</Label>
            <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto rounded-sm border border-paper-200 p-2.5">
              {CONFIRMED_SCOPES.map(({ scope, confirmed }) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="h-3.5 w-3.5 rounded-sm accent-vault-600" />
                  <code className="font-mono text-xs">{scope}</code>
                  {!confirmed && <span className="text-[10px] text-ink-600/40">(coming soon)</span>}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-ink-600/50">Only <code className="font-mono">customers:read</code> and <code className="font-mono">customers:write</code> are enforced in the current backend.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!appId || scopes.length === 0 || submitting} onClick={handleSubmit}>
            {submitting && <Spinner className="h-3.5 w-3.5 text-white" />}
            Create key
          </Button>
        </div>
      </div>
    </div>
  )
}

function RevealKeyModal({ apiKey, onClose }: { apiKey: ApiKeyCreated; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/10 text-gold-600">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-ink">Copy your key now</h3>
        </div>
        <p className="mt-3 text-sm text-ink-600/80">
          This is the only time the full key is shown. Meroe only stores a hash.
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-sm border border-gold-400/40 bg-gold-400/10 px-3 py-2.5">
          <code className="truncate font-mono text-xs text-ink">{apiKey.rawKey}</code>
          <CopyButton value={apiKey.rawKey} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}