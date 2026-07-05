import { Vault } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: React.ReactNode
  /** Shown below the logo as the page heading */
  heading: string
  /** Muted sub-heading line */
  subheading: string
  /** Small print link rendered below the card, e.g. "Don't have an account? Sign up" */
  footer?: React.ReactNode
}

export function AuthLayout({ children, heading, subheading, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Left branding panel ────────────────────────────────────── */}
      <div className="hidden w-[420px] shrink-0 flex-col justify-between bg-ink px-10 py-12 lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-vault-500">
            <Vault className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
          <span className="font-display text-base font-semibold text-paper">Meroe</span>
        </Link>

        <div>
          <blockquote className="text-xl font-medium leading-relaxed text-paper/90">
            "Virtual accounts, reconciliation,<br />
            and ledger infrastructure —<br />
            ready in minutes."
          </blockquote>
          <div className="mt-8 space-y-4">
            {[
              { label: 'Dedicated NUBANs', detail: 'per customer, auto-provisioned' },
              { label: 'Double-entry ledger', detail: 'six balance states, always in sync' },
              { label: 'HMAC-signed webhooks', detail: 'with exponential back-off retry' },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-vault-700/60 p-0.5">
                  <div className="h-full w-full rounded-full bg-vault-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-paper/90">{f.label}</p>
                  <p className="text-xs text-paper/45">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-paper/30">© 2026 Meroe · Infrastructure Track</p>
      </div>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo — only shown when the left panel is hidden */}
        <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-vault-500">
            <Vault className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <span className="font-display text-sm font-semibold text-ink">Meroe</span>
        </Link>

        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{heading}</h1>
            <p className="mt-1.5 text-sm text-ink-600/60">{subheading}</p>
          </div>

          {children}

          {footer && (
            <p className="mt-6 text-center text-sm text-ink-600/60">{footer}</p>
          )}
        </div>
      </div>
    </div>
  )
}
