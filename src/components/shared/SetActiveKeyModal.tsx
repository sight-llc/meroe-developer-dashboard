// ─────────────────────────────────────────────────────────────────────────
// SetActiveKeyModal — prompt for rawKey when selecting an existing API key
// ─────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { KeyRound, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { activeKeyStore } from '@/lib/active-key-store'
import type { ApiKey } from '@/types'

interface SetActiveKeyModalProps {
  apiKey: ApiKey
  allApiKeys?: ApiKey[]
  onClose: () => void
  onSuccess: () => void
}

export function SetActiveKeyModal({ apiKey, allApiKeys, onClose, onSuccess }: SetActiveKeyModalProps) {
  const [rawKey, setRawKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  function validateKey(input: string): boolean {
    // Key should start with the keyPrefix and have reasonable length
    if (!input.startsWith(apiKey.keyPrefix)) {
      setError(`Key must start with "${apiKey.keyPrefix}"`)
      return false
    }
    if (input.length < 20) {
      setError('Key is too short')
      return false
    }
    return true
  }

  function findMatchingKey(input: string): ApiKey | undefined {
    // Look up the key by prefix to get the correct lastFour and metadata
    if (!allApiKeys) return undefined
    return allApiKeys.find((k) => input.startsWith(k.keyPrefix))
  }

  function handleSetKey() {
    if (!validateKey(rawKey)) return

    // Look up the matching key to get correct lastFour and metadata
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
    onSuccess()
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
        
        <div className="mt-4 space-y-3">
          <div className="rounded-sm border border-paper-200 bg-paper-100 px-3 py-2">
            <p className="text-xs font-medium text-ink">
              {apiKey.keyPrefix}••••{apiKey.lastFour}
            </p>
            <p className="text-[11px] text-ink-600/60">
              {apiKey.appName ?? 'App'} • {apiKey.environment}
            </p>
          </div>
          
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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!rawKey || !!error} onClick={handleSetKey}>
            Set Active Key
          </Button>
        </div>
      </div>
    </div>
  )
}
