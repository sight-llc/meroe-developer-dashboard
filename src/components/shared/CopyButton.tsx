import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ink-600/60 hover:bg-paper-100 hover:text-ink',
        className,
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-vault-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}
