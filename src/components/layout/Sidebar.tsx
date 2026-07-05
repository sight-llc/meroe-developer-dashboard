import { NavLink, useNavigate } from 'react-router-dom'
import { NAV_ITEMS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function Sidebar() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-ink text-paper">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/meroe-logo.svg" alt="Meroe" className="h-7 w-7" />
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-tight">Meroe</p>
          <p className="text-[10px] uppercase tracking-wider text-paper/40">Developer</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-vault-700/40 text-paper font-medium'
                  : 'text-paper/55 hover:bg-white/5 hover:text-paper/90',
              )
            }
          >
            <item.icon className="h-4 w-4" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-paper/40">
          <span>Environment</span>
          <span className="inline-flex items-center gap-1 rounded-sm bg-gold-400/10 px-1.5 py-0.5 font-mono text-gold-400">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            live
          </span>
        </div>

        {session && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-paper/70">{session.developer.businessName}</p>
              <p className="truncate text-[11px] text-paper/35">{session.developer.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="shrink-0 rounded-sm p-1.5 text-paper/35 hover:bg-white/5 hover:text-paper/70 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
