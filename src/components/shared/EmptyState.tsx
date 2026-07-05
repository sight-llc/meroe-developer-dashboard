import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-paper-100">
        <Icon className="h-5 w-5 text-ink-600/60" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-xs text-sm text-ink-600/70">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
