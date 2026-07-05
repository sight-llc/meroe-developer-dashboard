import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { Users, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { NoApiKey } from '@/components/shared/NoApiKey'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getCustomers, getApps } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { formatDate } from '@/lib/utils'
import type { AccountStatus, App, Customer } from '@/types'

const STATUS_FILTERS: { value: AccountStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'CLOSED', label: 'Closed' },
]

export default function Customers() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AccountStatus | 'ALL'>('ALL')
  const [appId, setAppId] = useState('ALL')
  const navigate = useNavigate()

  const hasActiveKey = !!activeKeyStore.get()

  const { data: apps } = useQuery<App[]>({
    queryKey: ['apps'],
    queryFn: getApps,
  })

  const { data: customers, isLoading, error, refetch } = useQuery<Customer[]>({
    queryKey: ['customers', { search, status, appId }],
    queryFn: () => getCustomers({ search, status, appId }),
    enabled: hasActiveKey,
  })

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader eyebrow="Identity" title="Customers" description="Every customer provisioned with a dedicated NUBAN under your apps." />

      {!hasActiveKey && <NoApiKey />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-600/40" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or NUBAN" className="pl-9" />
        </div>
        <Select value={appId} onValueChange={setAppId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All apps" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All apps</SelectItem>
            {(apps ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as AccountStatus | 'ALL')}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="panel !p-0">
        {(customers ?? []).length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Try a different search term or filter." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">App</th>
                <th className="px-5 py-3 font-medium">NUBAN</th>
                <th className="px-5 py-3 font-medium">KYC tier</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {(customers ?? []).map((c) => {
                const app = (apps ?? []).find((a) => a.id === c.appId)
                return (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="cursor-pointer hover:bg-paper-100/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{c.fullName}</p>
                      <p className="text-xs text-ink-600/50">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-600/70">{app?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-600">{c.nuban}</td>
                    <td className="px-5 py-3.5 text-xs text-ink-600/70">{c.kycTier.replace('_', ' ')}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={c.accountStatus} /></td>
                    <td className="px-5 py-3.5 text-xs text-ink-600/50">{formatDate(c.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}