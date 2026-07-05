import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// SWAP: return request('/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
async function sendResetLink(email: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600))
  if (!email) throw new Error('Please enter your email address.')
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendResetLink(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      heading="Reset your password"
      subheading="Enter your email and we'll send a reset link."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-ink-600/60 hover:text-vault-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vault-50 text-vault-600">
            <MailCheck className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Check your inbox</p>
            <p className="mt-1 text-sm text-ink-600/60">
              If <span className="font-medium text-ink">{email}</span> is registered, a reset link is on its way.
            </p>
          </div>
          <p className="text-xs text-ink-600/40">Didn't get it? Check spam or try again in a minute.</p>
          <button
            onClick={() => setSent(false)}
            className="text-xs text-vault-600 hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="ops@yourcompany.dev"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-misdirected">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
