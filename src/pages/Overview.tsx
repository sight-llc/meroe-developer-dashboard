import { useQuery } from '@tanstack/react-query'
import { Card, AreaChart } from '@tremor/react'
import { Users, ArrowLeftRight, Wallet, Webhook, AlertCircle, LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { MockBadge } from '@/components/shared/MockBadge'
import { FeaturePage } from '@/components/shared/FeaturePage'
import { getOverviewStats, getVolumeSeries, getRecentActivity } from '@/lib/api'
import { formatCompactNgn, formatDateTime, formatPercent } from '@/lib/utils'
import type { OverviewStats, RecentActivityItem, VolumePoint } from '@/types'

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof Users
  label: string
  value: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <Card className="panel !p-4">
      <div className="flex items-center gap-2">
        <div
          className={
            tone === 'good'
              ? 'flex h-8 w-8 items-center justify-center rounded-sm bg-vault-50 text-vault-600'
              : tone === 'warn'
                ? 'flex h-8 w-8 items-center justify-center rounded-sm bg-gold-400/10 text-gold-600'
                : 'flex h-8 w-8 items-center justify-center rounded-sm bg-paper-100 text-ink-600'
          }
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <p className="label-eyebrow">{label}</p>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </Card>
  )
}

function OverviewContent() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: statsRefetch } = useQuery<OverviewStats>({
    queryKey: ['overview-stats'],
    queryFn: getOverviewStats,
  })

  const { data: volume, isLoading: volumeLoading, error: volumeError, refetch: volumeRefetch } = useQuery<VolumePoint[]>({
    queryKey: ['volume-series', 30],
    queryFn: () => getVolumeSeries(30),
  })

  const { data: activity, isLoading: activityLoading, error: activityError, refetch: activityRefetch } = useQuery<RecentActivityItem[]>({
    queryKey: ['recent-activity'],
    queryFn: getRecentActivity,
  })

  const loading = statsLoading || volumeLoading || activityLoading
  const error = statsError || volumeError || activityError
  const retry = () => { statsRefetch(); volumeRefetch(); activityRefetch() }

  const stateNode = <ApiStateDisplay loading={loading} error={error?.message ?? null} retry={retry} />
  if (loading || error) return stateNode

  const chartData = (volume ?? []).map((p) => ({
    date: p.date.slice(5),
    'Inbound volume': p.volumeNgn,
  }))

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        description="Your account's traffic, volume, and delivery health at a glance."
      />

      <div className="mb-4 flex items-center gap-2">
        <MockBadge />
        <span className="text-xs text-ink-600/50">Backend analytics endpoints not yet available — data is simulated</span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Users} label="Total customers" value={(stats?.totalCustomers ?? 0).toLocaleString()} />
        <Kpi icon={ArrowLeftRight} label="Total transactions" value={(stats?.totalTransactions ?? 0).toLocaleString()} />
        <Kpi icon={Wallet} label="Today's volume" value={formatCompactNgn(stats?.todaysVolumeNgn ?? '0')} tone="good" />
        <Kpi icon={Webhook} label="Webhook success" value={formatPercent(stats?.webhookSuccessRate ?? 0)} tone="good" />
        <Kpi
          icon={AlertCircle}
          label="API error rate"
          value={formatPercent(stats?.apiErrorRate ?? 0)}
          tone={(stats?.apiErrorRate ?? 0) > 0.05 ? 'warn' : 'default'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="panel !p-5 lg:col-span-2">
          <p className="label-eyebrow">Inbound volume — last 30 days</p>
          <AreaChart
            className="mt-4 h-64"
            data={chartData}
            index="date"
            categories={['Inbound volume']}
            colors={['emerald']}
            valueFormatter={(v) => formatCompactNgn(v)}
            showLegend={false}
            showGridLines
            curveType="monotone"
          />
        </Card>

        <Card className="panel !p-5">
          <p className="label-eyebrow">Recent activity</p>
          <ul className="mt-3 divide-y divide-paper-200">
            {(activity ?? []).slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-ink-600/80">
                    {item.method} {item.path}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-600/50">{formatDateTime(item.timestamp)}</p>
                </div>
                <StatusBadge
                  status={item.statusCode < 300 ? 'MATCHED' : item.statusCode >= 500 ? 'MISDIRECTED' : 'UNMATCHED'}
                  label={String(item.statusCode)}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

export default function Overview() {
  return (
    <FeaturePage
      feature="MOCK_UI"
      comingSoon={{
        icon: LayoutDashboard,
        title: 'Platform Overview',
        description:
          'A real-time snapshot of your transaction volume, customer growth, webhook health, and API error rate.',
        features: [
          '30-day inbound volume area chart',
          'KPI cards: customers, transactions, daily volume',
          'Webhook delivery success rate',
          'API error rate monitoring',
          'Recent API activity feed',
        ],
        eta: 'Phase 2 — backend analytics endpoints',
      }}
    >
      <OverviewContent />
    </FeaturePage>
  )
}