import {
  LayoutDashboard,
  KeyRound,
  Webhook,
  Users,
  Scale,
  ScrollText,
  FlaskConical,
  Settings,
  AppWindow,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',       path: '/',              icon: LayoutDashboard },
  { label: 'Apps',           path: '/apps',          icon: AppWindow },
  { label: 'API Keys',       path: '/keys',          icon: KeyRound },
  { label: 'Webhooks',       path: '/webhooks',      icon: Webhook },
  { label: 'Customers',      path: '/customers',     icon: Users },
  { label: 'Reconciliation', path: '/reconciliation',icon: Scale },
  { label: 'Transfers',      path: '/transfers',     icon: ArrowUpRight },
  { label: 'API Logs',       path: '/logs',          icon: ScrollText },
  { label: 'Sandbox',        path: '/sandbox',       icon: FlaskConical },
  { label: 'Settings',       path: '/settings',      icon: Settings },
]
