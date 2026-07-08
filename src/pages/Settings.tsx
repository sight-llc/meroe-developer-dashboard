import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { ShieldCheck, Upload, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Spinner } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDeveloperProfile, updateDeveloperProfile, uploadKycDocuments, changePassword, setTransactionPin } from '@/lib/api'
import type { DeveloperProfile } from '@/types'

function SettingsContent() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading, error, refetch } = useQuery<DeveloperProfile>({
    queryKey: ['developer-profile'],
    queryFn: getDeveloperProfile,
  })

  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Sync form state when profile loads
  const [initialized, setInitialized] = useState(false)
  if (profile && !initialized) {
    setBusinessName(profile.businessName)
    setEmail(profile.email)
    setPhone(profile.phone)
    setInitialized(true)
  }

  const updateProfileMutation = useMutation({
    mutationFn: (input: Partial<Pick<DeveloperProfile, 'businessName' | 'email' | 'phone'>>) => updateDeveloperProfile(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['developer-profile'], data)
      toast.success('Profile updated')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save'),
  })

  const kycMutation = useMutation({
    mutationFn: uploadKycDocuments,
    onSuccess: (data) => {
      const current = queryClient.getQueryData<DeveloperProfile>(['developer-profile'])
      if (current) {
        queryClient.setQueryData(['developer-profile'], { ...current, kycStatus: data.kycStatus })
      }
      toast.success('Documents submitted — KYC review in progress')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Upload failed'),
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Password updated')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update password'),
  })

  const [pin, setPin] = useState(['', '', '', ''])
  const [pinPassword, setPinPassword] = useState('')

  const pinMutation = useMutation({
    mutationFn: () => setTransactionPin(pin.join(''), pinPassword),
    onSuccess: () => {
      setPin(['', '', '', ''])
      setPinPassword('')
      toast.success('Transaction PIN set')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to set PIN'),
  })

  const stateNode = <ApiStateDisplay loading={isLoading} error={error?.message ?? null} retry={refetch} />
  if (isLoading || error || !profile) return stateNode

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    updateProfileMutation.mutate({ businessName, email, phone })
  }

  function handleToggleLive() {
    if (!profile) return
    if (profile.kycStatus !== 'APPROVED') {
      toast.warning('KYC must be approved before enabling live mode')
      return
    }
    const updated: DeveloperProfile = { ...profile, liveEnabled: !profile.liveEnabled }
    queryClient.setQueryData(['developer-profile'], updated)
    toast.success(profile.liveEnabled ? 'Live mode disabled' : 'Live mode enabled')
  }

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword || !newPassword) return
    passwordMutation.mutate({ currentPassword, newPassword })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" description="Business profile, verification, and security." />

      {/* Data is now live from backend */}

      <div className="space-y-5">
        <Card className="panel !p-5">
          <p className="label-eyebrow">Business profile</p>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5"><Label htmlFor="biz-name">Business name</Label><Input id="biz-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="biz-phone">Phone</Label><Input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="font-mono" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="biz-email">Email</Label><Input id="biz-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
            <Button type="submit" disabled={updateProfileMutation.isPending} size="sm">
              {updateProfileMutation.isPending && <Spinner className="h-3.5 w-3.5 text-white" />}
              Save changes
            </Button>
          </form>
        </Card>

        <Card className="panel !p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-eyebrow">Verification</p>
              <p className="mt-1 text-sm text-ink-600/70">KYC status for accessing the live environment.</p>
            </div>
            <StatusBadge status={profile.kycStatus} />
          </div>
          {profile.kycStatus !== 'APPROVED' && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => kycMutation.mutate()} disabled={kycMutation.isPending}>
              {kycMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              Upload verification documents
            </Button>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-paper-200 pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className={profile.liveEnabled ? 'h-4 w-4 text-vault-600' : 'h-4 w-4 text-ink-600/40'} />
              <div>
                <p className="text-sm font-medium text-ink">Live environment</p>
                <p className="text-xs text-ink-600/60">{profile.kycStatus === 'APPROVED' ? 'Process real customer payments.' : 'Requires approved KYC before this can be enabled.'}</p>
              </div>
            </div>
            <button
              onClick={handleToggleLive}
              disabled={profile.kycStatus !== 'APPROVED'}
              className={profile.liveEnabled ? 'relative h-6 w-11 rounded-full bg-vault-600 transition-colors disabled:opacity-40' : 'relative h-6 w-11 rounded-full bg-paper-200 transition-colors disabled:opacity-40'}
            >
              <span className={profile.liveEnabled ? 'absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all' : 'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all'} />
            </button>
          </div>
        </Card>

        <Card className="panel !p-5">
          <p className="label-eyebrow">Change password</p>
          <form onSubmit={handlePasswordChange} className="mt-4 grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5"><Label htmlFor="cur-pw">Current password</Label><Input id="cur-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="new-pw">New password</Label><Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="col-span-2">
              <Button type="submit" variant="outline" size="sm" disabled={passwordMutation.isPending}>
                {passwordMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
                Update password
              </Button>
            </div>
          </form>
        </Card>

        <Card className="panel !p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-ink-600/60" />
            <p className="label-eyebrow">Transaction PIN</p>
          </div>
          <p className="mt-1 text-sm text-ink-600/70">4-digit PIN for authorising money-out (payouts, refunds). Required for live environment.</p>
          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label>4-digit PIN</Label>
              <div className="flex gap-2">
                {pin.map((digit, i) => (
                  <Input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      if (val.length > 1) return
                      const newPin = [...pin]
                      newPin[i] = val
                      setPin(newPin)
                      if (val && i < 3) {
                        const nextInput = e.currentTarget.parentElement?.children[i + 1]?.querySelector('input')
                        nextInput?.focus()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !pin[i] && i > 0) {
                        const prevInput = e.currentTarget.parentElement?.children[i - 1]?.querySelector('input')
                        prevInput?.focus()
                      }
                    }}
                    className="h-12 w-12 text-center font-mono text-lg"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-password">Current password (to confirm)</Label>
              <Input id="pin-password" type="password" value={pinPassword} onChange={(e) => setPinPassword(e.target.value)} placeholder="Enter your login password" />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pinMutation.isPending || pin.join('').length !== 4 || !pinPassword}
              onClick={() => pinMutation.mutate()}
            >
              {pinMutation.isPending && <Spinner className="h-3.5 w-3.5 text-white" />}
              Set transaction PIN
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function Settings() {
  return <SettingsContent />
}
