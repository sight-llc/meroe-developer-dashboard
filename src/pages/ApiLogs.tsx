import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { ScrollText, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { MockBadge } from '@/components/shared/MockBadge'
import { FeaturePage } from '@/components/shared/FeaturePage'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { getApiLogs } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { ApiLogEntry, Environment } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: '2xx', label: '2xx success' },
  { value: '4xx', label: '4xx client error' },
  { value: '5xx', label: '5xx server error' },
]

function statusTone(code: number) {
  if (code < 300) return 'text-vault-600'
  if (code < 500) return 'text-gold-600'
  return 'text-misdirected'
}

function methodTone(method: string) {
  switch (method) {
    case 'GET': return 'text-ink-600'
    case 'POST': return 'text-vault-600'
    case 'PATCH': case 'PUT': return 'text-gold-600'
    case 'DELETE': return 'text-misdirected'
    default: return 'text-ink-600'
  }
}

function ApiLogsContent() {
  const [statusCode, setStatusCode] = useState('all')
  const [environment, setEnvironment] = useState<Environment | 'all'>('all')
  const [path, setPath] = useState('')
  const [selected, setSelected] = useState<ApiLogEntry | null>(null)

  const { data: logs, isLoading, error, refetch } = useQuery<ApiLogEntry[]>({
    queryKey: ['api-logs', { statusCode, environment, path }],
    queryFn: () => getApiLogs({
      statusCode: statusCode === 'all' ? undefined : statusCode,
      environment: environment === 'all' ? undefined : environment,
      path: path || undefined,
    }),
  })

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error) return stateNode

  return (
    <div>
      <PageHeader eyebrow="Observability" title="API logs" description="Every request to the Meroe API from your keys. Retained for 90 days." />

      <div className="mb-4 flex items-center gap-2">
        <MockBadge />
        <span className="text-xs text-ink-600/50">Backend logs endpoint not yet available — data is simulated</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="Filter by path, e.g. /v1/customers" className="w-64" />
        <Select value={statusCode} onValueChange={setStatusCode}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as Environment | 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All environments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All environments</SelectItem>
            <SelectItem value="live">live</SelectItem>
            <SelectItem value="sandbox">sandbox</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="panel !p-0">
        {(logs ?? []).length === 0 ? (
          <EmptyState icon={ScrollText} title="No matching requests" description="Adjust your filters to see more logs." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Path</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Latency</th>
                <th className="px-5 py-3 font-medium">Environment</th>
                <th className="px-5 py-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-200">
              {(logs ?? []).map((log) => (
                <tr key={log.id} onClick={() => setSelected(log)} className="cursor-pointer hover:bg-paper-100/60">
                  <td className={`px-5 py-3 font-mono text-xs font-medium ${methodTone(log.method)}`}>{log.method}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink">{log.path}</td>
                  <td className={`px-5 py-3 font-mono text-xs font-medium ${statusTone(log.statusCode)}`}>{log.statusCode}</td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-600/70">{log.latencyMs}ms</td>
                  <td className="px-5 py-3 text-xs text-ink-600/60">{log.environment}</td>
                  <td className="px-5 py-3 text-xs text-ink-600/50">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-[2px]">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className={`font-mono text-xs font-medium ${methodTone(selected.method)}`}>{selected.method}</p>
                <p className="mt-1 font-mono text-sm text-ink">{selected.path}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-600/50 hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-ink-600/50">Status</p><p className={`mt-0.5 font-mono font-medium ${statusTone(selected.statusCode)}`}>{selected.statusCode}</p></div>
              <div><p className="text-ink-600/50">Latency</p><p className="mt-0.5 font-mono">{selected.latencyMs}ms</p></div>
              <div><p className="text-ink-600/50">Environment</p><p className="mt-0.5 font-mono">{selected.environment}</p></div>
            </div>
            <div className="mt-5">
              <p className="label-eyebrow">Request body</p>
              <pre className="mt-1.5 overflow-x-auto rounded-sm bg-paper-100 p-3 font-mono text-xs text-ink-600">{selected.requestBody ? JSON.stringify(selected.requestBody, null, 2) : '— empty —'}</pre>
            </div>
            <div className="mt-4">
              <p className="label-eyebrow">Response body</p>
              <pre className="mt-1.5 overflow-x-auto rounded-sm bg-paper-100 p-3 font-mono text-xs text-ink-600">{selected.responseBody ? JSON.stringify(selected.responseBody, null, 2) : '— empty —'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiLogs() {
  return (
    <FeaturePage
      feature="MOCK_UI"
      comingSoon={{
        icon: ScrollText,
        title: 'API Logs',
        description: 'Full request and response log for every call made to the Meroe API with your keys, retained for 90 days.',
        features: [
          'Filter by status code, path, and environment',
          'Request and response body inspector',
          'Latency tracking per endpoint',
          '90-day log retention',
        ],
        eta: 'Phase 2 — api_request_logs query endpoint',
      }}
    >
      <ApiLogsContent />
    </FeaturePage>
  )
}