import { Construction } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description: string
  features: string[]
  icon: LucideIcon
  eta?: string
}

export function ComingSoon({ title, description, features, icon: Icon, eta }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-paper-100 ring-1 ring-paper-200">
          <Icon className="h-7 w-7 text-ink-600/40" strokeWidth={1.5} />
        </div>
        <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/30">
          <Construction className="h-3.5 w-3.5 text-gold-600" strokeWidth={2} />
        </div>
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 text-[11px] font-medium text-gold-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
        In development
      </div>

      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600/60">{description}</p>

      <div className="mt-8 w-full max-w-sm rounded-lg border border-paper-200 bg-white p-5 text-left shadow-card">
        <p className="label-eyebrow mb-3">What's coming</p>
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600/70">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vault-400" />
              {f}
            </li>
          ))}
        </ul>
        {eta && (
          <p className="mt-4 border-t border-paper-200 pt-4 text-xs text-ink-600/40">
            Estimated: {eta}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-ink-600/35">
        Set <code className="rounded bg-paper-100 px-1 py-0.5 font-mono">VITE_MOCK_UI=enabled</code> to
        preview mock UI for this page.
      </p>
    </div>
  )
}
