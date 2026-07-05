import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colours = ['', 'bg-misdirected', 'bg-gold-500', 'bg-gold-400', 'bg-vault-500']

  if (!password) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={cn('h-1 flex-1 rounded-full transition-all duration-300', n <= score ? colours[score] : 'bg-paper-200')} />
        ))}
      </div>
      <p className="text-[11px] text-ink-600/50">{labels[score]}</p>
    </div>
  )
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const tid = toast.loading('Creating your account…')
    try {
      await register({ name, email, company, password })
      toast.success('Account created — welcome to Meroe', { id: tid })
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.'
      setError(msg)
      toast.error(msg, { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      heading="Create your account"
      subheading="Get your sandbox keys and first virtual account in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-vault-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" placeholder="Ada Okonkwo" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company">Company</Label>
            <Input id="company" placeholder="Acme Fintech Ltd" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" placeholder="ops@acmefintech.dev" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600/40 hover:text-ink-600">
              {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        {error && (
          <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-misdirected">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Creating account…</>
          ) : (
            <>Create account <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></>
          )}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-ink-600/45">
          By creating an account you agree to Meroe's{' '}
          <span className="text-ink-600/70">Terms of Service</span> and{' '}
          <span className="text-ink-600/70">Privacy Policy</span>.
        </p>
      </form>
    </AuthLayout>
  )
}
