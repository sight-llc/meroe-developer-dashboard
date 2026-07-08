import { useQuery } from '@tanstack/react-query'
import { Card, AreaChart } from '@tremor/react'
import { Users, ArrowLeftRight, Wallet, Webhook, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { getOverviewStats, getVolumeSeries, getRecentActivity } from '@/lib/api'
import { formatCompactNgn, formatDateTime } from '@/lib/utils'
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

  const totalVolume = (parseFloat(stats?.inboundVolume ?? '0') + parseFloat(stats?.payoutVolume ?? '0'))

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Overview"
        description="Your account's traffic, volume, and delivery health at a glance."
      />

      {/* Data is now live from backend */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Users} label="Total customers" value={(stats?.customers ?? 0).toLocaleString()} />
        <Kpi icon={ArrowLeftRight} label="Total apps" value={(stats?.apps ?? 0).toLocaleString()} />
        <Kpi icon={Webhook} label="Active API keys" value={(stats?.activeApiKeys ?? 0).toLocaleString()} />
        <Kpi icon={Webhook} label="Active webhooks" value={(stats?.activeWebhookSubscriptions ?? 0).toLocaleString()} />
        <Kpi icon={Wallet} label="Total volume" value={formatCompactNgn(totalVolume)} tone="good" />
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
             {(activity ?? []).slice(0, 8).map((item, index) => (
               <li key={index} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                 <div className="min-w-0">
                   <p className="truncate font-mono text-xs text-ink-600/80">
                     {item.kind === 'INBOUND' ? <ArrowDownLeft className="inline h-3 w-3 text-vault-600" /> : <ArrowUpRight className="inline h-3 w-3 text-ink-600" />} {item.counterparty}
                   </p>
                   <p className="mt-0.5 text-[11px] text-ink-600/50">{item.narration}</p>
                 </div>
                 <div className="text-right">
                   <p className="font-mono text-xs font-medium text-ink">{formatCompactNgn(String(item.amount))}</p>
                   <p className="mt-0.5 text-[11px] text-ink-600/50">{formatDateTime(item.occurredAt)}</p>
                   <StatusBadge status={item.status} label={item.status} />
                 </div>
               </li>
             ))}
           </ul>
         </Card>
      </div>
    </div>
  )
}

export default function Overview() {
  return <OverviewContent />
}
