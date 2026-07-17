import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { AppWindow, Plus, Pencil, PowerOff, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApps, createApp, updateApp, deactivateApp, getDeveloperProfile } from '@/lib/api'
import { envStore } from '@/lib/env-store'
import { formatDate } from '@/lib/utils'
import type { App, DeveloperProfile, Environment } from '@/types'

export default function Apps() {
  const queryClient = useQueryClient()
  const { data: apps, isLoading, error, refetch } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: getApps,
  })

  const { data: profile } = useQuery<DeveloperProfile>({
    queryKey: ['developer-profile'],
    queryFn: getDeveloperProfile,
    staleTime: 60_000,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<App | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<App | null>(null)

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description: string; environment?: Environment }) => {
      const headers: Record<string, string> = input.environment === 'live' ? { 'X-Environment': 'live' } : {}
      return createApp({ name: input.name, description: input.description }, Object.keys(headers).length ? headers : undefined)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
      toast.success(`"${data.name}" created`)
      setCreateOpen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create app'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; description?: string }) => updateApp(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
      toast.success('App updated')
      setEditTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
      toast.success('App deactivated')
      setDeactivateTarget(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to deactivate'),
  })

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader
        eyebrow="Applications"
        title="Apps"
        description="Each app is a namespace for customers, API keys, and webhook subscriptions."
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New app</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(apps ?? []).length === 0 ? (
          <div className="col-span-3">
            <EmptyState icon={AppWindow} title="No apps yet" description="Create an app to start provisioning customers and API keys." />
          </div>
        ) : (
          (apps ?? []).map((app) => (
            <Card key={app.id} className="panel !p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-vault-50 font-semibold text-sm text-vault-700">
                    {app.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{app.name}</p>
                    <p className="text-[11px] text-ink-600/50">
                      {app.environment} · <span className="font-mono">{app.slug}</span>
                    </p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <p className="min-h-[2.5rem] line-clamp-2 text-sm text-ink-600/60">
                {app.description || 'No description.'}
              </p>

              <div className="flex items-center justify-between border-t border-paper-200 pt-3">
                <p className="text-xs text-ink-600/50">Created {formatDate(app.createdAt)}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditTarget(app)} className="rounded-sm p-1.5 text-ink-600/50 hover:bg-paper-100 hover:text-ink" title="Rename">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {app.status === 'ACTIVE' && (
                    <button onClick={() => setDeactivateTarget(app)} className="rounded-sm p-1.5 text-ink-600/50 hover:bg-red-50 hover:text-misdirected" title="Deactivate">
                      <PowerOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {createOpen && (
        <AppFormModal
          title="Create app"
          liveEnabled={profile?.liveEnabled ?? false}
          onClose={() => setCreateOpen(false)}
          onSave={async (data) => { createMutation.mutate(data) }}
        />
      )}

      {editTarget && (
        <AppFormModal
          title="Rename app"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (data) => { updateMutation.mutate({ id: editTarget.id, name: data.name, description: data.description }) }}
        />
      )}

      <ConfirmModal
        open={!!deactivateTarget}
        title={`Deactivate "${deactivateTarget?.name}"?`}
        description="This suspends all API keys and webhook deliveries under this app. Customers and their data are preserved."
        confirmLabel="Deactivate"
        tone="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  )
}

function AppFormModal({ title, initial, liveEnabled, onClose, onSave }: {
  title: string; initial?: App; liveEnabled?: boolean; onClose: () => void
  onSave: (data: { name: string; description: string; environment?: Environment }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [environment, setEnvironment] = useState<Environment>(initial?.environment ?? 'sandbox')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const payload: { name: string; description: string; environment?: Environment } = {
      name: name.trim(),
      description: description.trim(),
    }
    // Only send environment override on create (not edit), and only if different from current global env
    if (!initial && environment !== envStore.get()) {
      payload.environment = environment
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-600/40 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3.5">
          <div className="space-y-1.5"><Label htmlFor="app-name">Name</Label><Input id="app-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Checkout Engine" autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="app-desc">Description</Label><Input id="app-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this app used for?" /></div>
          {liveEnabled && !initial && (
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnvironment('sandbox')}
                  className={`rounded-sm border px-3 py-2 text-left text-sm ${
                    environment === 'sandbox'
                      ? 'border-vault-500 bg-vault-50 font-medium text-vault-700'
                      : 'border-paper-200 text-ink-600 hover:bg-paper-100'
                  }`}
                >
                  Sandbox
                  <span className="block text-[11px] font-normal text-ink-600/50">Test with mock payments</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment('live')}
                  className={`rounded-sm border px-3 py-2 text-left text-sm ${
                    environment === 'live'
                      ? 'border-gold-500 bg-gold-400/10 font-medium text-gold-700'
                      : 'border-paper-200 text-ink-600 hover:bg-paper-100'
                  }`}
                >
                  Live
                  <span className="block text-[11px] font-normal text-ink-600/50">Real customer payments</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? <Spinner className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}