import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Check, ChevronDown, KeyRound, AlertCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { NAV_ITEMS } from '@/lib/constants'
import { getDeveloperProfile, getApiKeys } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { envStore } from '@/lib/env-store'
import type { DeveloperProfile, ApiKey, Environment } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SetActiveKeyModal } from '@/components/shared/SetActiveKeyModal'

export function Topbar() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [setKeyModal, setSetKeyModal] = useState<ApiKey | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [currentEnv, setCurrentEnv] = useState<Environment>(envStore.get())

  const { data: profile } = useQuery<DeveloperProfile>({
    queryKey: ['developer-profile'],
    queryFn: getDeveloperProfile,
    staleTime: 60_000,
  })

  const { data: apiKeys } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => getApiKeys(),
    staleTime: 30_000,
  })

  const activeKey = activeKeyStore.get()
  const activeKeys = (apiKeys ?? []).filter((k) => k.status === 'ACTIVE')

  const current =
    NAV_ITEMS.find((item) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)))
      ?.label ?? 'Overview'

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Reset env to sandbox if profile doesn't have live enabled
  useEffect(() => {
    if (profile && !profile.liveEnabled && envStore.get() === 'live') {
      envStore.set('sandbox')
      setCurrentEnv('sandbox')
      queryClient.clear()
    }
  }, [profile, queryClient])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-paper-200 bg-white px-6">
      <p className="text-sm font-medium text-ink-600/70">{current}</p>
      <div className="flex items-center gap-3">
        {/* ── Active API Key Selector ──────────────────────── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs transition-colors ${
              activeKey
                ? 'border-vault-200 bg-vault-50/50 text-vault-700 hover:bg-vault-50'
                : 'border-red-200 bg-red-50/50 text-red-700 hover:bg-red-50'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="font-mono">
              {activeKey ? activeKeyStore.getLabel() : 'No API key'}
            </span>
            {activeKey && (
              <span className={`text-[10px] ${activeKey.environment === 'live' ? 'text-gold-600' : 'text-ink-600/60'}`}>
                {activeKey.environment}
              </span>
            )}
            {!activeKey && <AlertCircle className="h-3 w-3 text-red-500" />}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-sm border border-paper-200 bg-white shadow-lg">
              <div className="border-b border-paper-200 px-3 py-2">
                <p className="text-xs font-medium text-ink-600/60">Active API Key</p>
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {activeKeys.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-ink-600/50">
                    No active keys. Create one in{' '}
                    <a href="/keys" className="text-vault-600 underline underline-offset-2">
                      API Keys
                    </a>
                    .
                  </p>
                ) : (
                  activeKeys.map((key) => {
                    const isActive = activeKey?.rawKey?.startsWith(key.keyPrefix) ?? false
                    return (
                      <button
                        key={key.id}
                        onClick={() => {
                          setSetKeyModal(key)
                          setDropdownOpen(false)
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-paper-100 ${
                          isActive ? 'bg-vault-50/50' : ''
                        }`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isActive ? 'border-vault-500 bg-vault-500' : 'border-paper-300'
                        }`}>
                          {isActive && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-mono text-ink">
                            {key.keyPrefix}••••{key.lastFour}
                          </p>
                          <p className="text-ink-600/50">
                            {key.environment} · {key.scopes.slice(0, 2).join(', ')}
                            {key.scopes.length > 2 ? '…' : ''}
                          </p>
                        </div>
                        <StatusBadge status={key.status} />
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Environment Toggle (sandbox / live) ──────────── */}
        {profile?.liveEnabled && (
          <>
            <div className="h-4 w-px bg-paper-200" />
            <div className="flex items-center gap-0.5 rounded-sm border border-paper-200 p-0.5">
              {(['sandbox', 'live'] as Environment[]).map((env) => (
                <button
                  key={env}
                  onClick={() => {
                    envStore.set(env)
                    setCurrentEnv(env)
                    queryClient.clear()
                  }}
                  className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    currentEnv === env
                      ? env === 'live'
                        ? 'bg-gold-400/15 text-gold-700'
                        : 'bg-vault-50 text-vault-700'
                      : 'text-ink-600/50 hover:text-ink-600/80'
                  }`}
                >
                  {env === 'sandbox' ? 'Sandbox' : 'Live'}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Developer Profile ───────────────────────────── */}
        {profile && (
          <>
            <div className="h-4 w-px bg-paper-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-vault-50 font-mono text-xs font-semibold text-vault-700">
                {profile.businessName.slice(0, 1)}
              </div>
              <span className="text-sm text-ink">{profile.businessName}</span>
            </div>
          </>
        )}
      </div>

       {setKeyModal && (
         <SetActiveKeyModal
           apiKey={setKeyModal}
           allApiKeys={apiKeys ?? []}
           onClose={() => setSetKeyModal(null)}
           onSuccess={() => setSetKeyModal(null)}
         />
       )}
    </header>
  )
}
