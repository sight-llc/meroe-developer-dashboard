// ─────────────────────────────────────────────────────────────────────────
// RequireApiKeyModal — modal shown when API key is required but not set
// Used on pages that need an active API key (Transfers, Customers, etc.)
// ─────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { KeyRound, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Link } from 'react-router-dom'
import { activeKeyStore } from '@/lib/active-key-store'
import type { ApiKey } from '@/types'

interface RequireApiKeyModalProps {
  apiKeys: ApiKey[]
  onKeySet: () => void
}

export function RequireApiKeyModal({ apiKeys, onKeySet }: RequireApiKeyModalProps) {
  const [rawKey, setRawKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  function findMatchingKey(input: string): ApiKey | undefined {
    return apiKeys.find((k) => input.startsWith(k.keyPrefix))
  }

  function handleSetKey() {
    if (!rawKey) {
      setError('Please enter an API key')
      return
    }

    const matchingKey = findMatchingKey(rawKey)

    if (!matchingKey) {
      setError('Key not found. Please ensure you entered a valid key from your API keys list.')
      return
    }

    activeKeyStore.set({
      rawKey,
      keyPrefix: matchingKey.keyPrefix,
      lastFour: matchingKey.lastFour,
      appName: matchingKey.appName,
      appId: matchingKey.appId,
      environment: matchingKey.environment,
    })
    onKeySet()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vault-50 text-vault-600">
            <KeyRound className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-ink">Set Active API Key</h3>
        </div>

        <p className="mt-3 text-sm text-ink-600/80">
          Outbound transfers require an active API key to fetch data. Select a key from your list below.
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rawKey">Raw API Key</Label>
            <Input
              id="rawKey"
              type="password"
              value={rawKey}
              onChange={(e) => {
                setRawKey(e.target.value)
                setError(null)
              }}
              placeholder="Enter your API key"
              className="font-mono text-xs"
            />
            {error && (
              <div className="flex items-center gap-1.5 text-[11px] text-misdirected">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
            <p className="text-[11px] text-ink-600/50">
              Enter the full key (shown only when created). Meroe only stores a hash.
            </p>
          </div>

          {apiKeys.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-600">Your API keys:</p>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {apiKeys.map((key) => (
                  <div key={key.id} className="rounded-sm border border-paper-200 bg-paper-100 px-3 py-2">
                    <p className="text-xs font-medium text-ink">
                      {key.keyPrefix}••••{key.lastFour}
                    </p>
                    <p className="text-[11px] text-ink-600/60">
                      {key.appName ?? 'App'} • {key.environment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {apiKeys.length === 0 && (
            <div className="rounded-sm border border-gold-400/40 bg-gold-400/10 px-3 py-2">
              <p className="text-xs text-gold-800">
                No API keys found.{' '}
                <Link to="/keys" className="font-medium underline underline-offset-2 hover:text-gold-800">
                  Create one first
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Link to="/keys">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-3.5 w-3.5" />
              Go to API Keys
            </Button>
          </Link>
          <Button size="sm" disabled={!rawKey} onClick={handleSetKey}>
            Set Active Key
          </Button>
        </div>
      </div>
    </div>
  )
}