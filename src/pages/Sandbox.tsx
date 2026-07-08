import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@tremor/react'
import { FlaskConical, Terminal } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ApiStateDisplay } from '@/components/shared/ApiStateDisplay'
import { CopyButton } from '@/components/shared/CopyButton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCustomers, getSandboxHistory } from '@/lib/api'
import { activeKeyStore } from '@/lib/active-key-store'
import { formatNgn, formatDateTime } from '@/lib/utils'
import type { Customer, SandboxScenario, SandboxSimulation } from '@/types'

const SCENARIOS: { value: SandboxScenario; label: string; hint: string }[] = [
  { value: 'success', label: 'Success', hint: 'Sender name matches the account holder — reconciles automatically.' },
  { value: 'sender_mismatch', label: 'Sender mismatch', hint: 'Sender name does not match — flags as misdirected.' },
  { value: 'duplicate', label: 'Duplicate', hint: 'Same external reference sent twice — flags as duplicate.' },
]

export default function Sandbox() {
  const [amount, setAmount] = useState('5000.00')
  const [senderName, setSenderName] = useState('')
  const [scenario, setScenario] = useState<SandboxScenario>('success')
  const [virtualAccountId, setVirtualAccountId] = useState('')

  const hasActiveKey = !!activeKeyStore.get()

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers', { status: 'ALL' }],
    queryFn: () => getCustomers({ status: 'ALL' }),
    enabled: hasActiveKey,
  })

  const { data: history, isLoading: histLoading, error: histError, refetch: histRefetch } = useQuery<SandboxSimulation[]>({
    queryKey: ['sandbox-history'],
    queryFn: getSandboxHistory,
  })

  // Auto-set defaults once customers load
  const [initialized, setInitialized] = useState(false)
  if (customers && customers.length > 0 && !initialized) {
    const sandbox = customers.find((c) => c.environment === 'sandbox') ?? customers[0]
    setVirtualAccountId(sandbox.id)
    setSenderName(sandbox.fullName)
    setInitialized(true)
  }

  const selectedCustomer = (customers ?? []).find((c) => c.id === virtualAccountId)
  const accountRef = selectedCustomer?.nuban ?? 'ACCOUNT_REF'

  const cliCommand = [
    'python webhook_simulator.py',
    `--account-ref ${accountRef}`,
    `--amount ${amount || '5000.00'}`,
    `--sender-name "${senderName || 'Test Sender'}"`,
    `--scenario ${scenario}`,
  ].join(' \\\n  ')

  return (
    <div>
      <PageHeader
        eyebrow="Testing"
        title="Sandbox"
        description="Simulated inbound payments are triggered from your machine via the Meroe CLI webhook simulator — it posts directly to /v1/webhooks/nomba, exercising the same reconciliation and ledger logic as a real Nomba payment."
      />

      {/* Data is now live from backend */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Builder */}
        <Card className="panel !p-5 lg:col-span-1">
          <p className="label-eyebrow">Build a simulation</p>
          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label>Virtual account</Label>
              <Select
                value={virtualAccountId}
                onValueChange={(v) => {
                  setVirtualAccountId(v)
                  const c = (customers ?? []).find((cust) => cust.id === v)
                  if (c) setSenderName(c.fullName)
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.nuban}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-amount">Amount (NGN)</Label>
              <Input id="sim-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-sender">Sender name</Label>
              <Input id="sim-sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Scenario</Label>
              <div className="space-y-1.5">
                {SCENARIOS.map((s) => (
                  <label
                    key={s.value}
                    className={
                      scenario === s.value
                        ? 'flex cursor-pointer items-start gap-2 rounded-sm border border-vault-500 bg-vault-50 p-2.5'
                        : 'flex cursor-pointer items-start gap-2 rounded-sm border border-paper-200 p-2.5 hover:bg-paper-100'
                    }
                  >
                    <input type="radio" checked={scenario === s.value} onChange={() => setScenario(s.value)} className="mt-0.5 accent-vault-600" />
                    <span>
                      <span className="block text-sm font-medium text-ink">{s.label}</span>
                      <span className="block text-[11px] text-ink-600/60">{s.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* CLI command */}
          <div className="mt-5 rounded-sm border border-ink bg-ink p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-paper/50">
                <Terminal className="h-3 w-3" /> Run from your terminal
              </div>
              <CopyButton
                value={cliCommand}
                className="text-paper/60 hover:bg-white/10 hover:text-paper"
              />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-vault-300">
{cliCommand}
            </pre>
          </div>
          <p className="mt-2 text-[11px] text-ink-600/45">
            Requires the sandbox CLI tool and your sandbox API key set as{' '}
            <code className="font-mono">MEROE_API_KEY</code>.
          </p>
        </Card>

        {/* History */}
        <Card className="panel !p-0 lg:col-span-2">
          <p className="label-eyebrow px-5 pt-5">Recent sandbox webhooks received</p>
          {histLoading ? (
            <ApiStateDisplay loading={histLoading} error={null} retry={histRefetch} />
          ) : histError ? (
            <ApiStateDisplay loading={false} error={histError?.message ?? null} retry={histRefetch} />
          ) : (history ?? []).length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No simulations yet"
              description="Run the CLI command to send a simulated webhook — it'll appear here with its reconciliation result."
            />
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-y border-paper-200 text-left text-xs uppercase tracking-wide text-ink-600/50">
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Scenario</th>
                  <th className="px-5 py-2.5 font-medium">Result</th>
                  <th className="px-5 py-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-200">
                {(history ?? []).map((sim) => (
                  <tr key={sim.id}>
                    <td className="px-5 py-3 text-ink">{sim.customerName}</td>
                    <td className="px-5 py-3 font-mono text-xs tabular-nums">{formatNgn(sim.amount)}</td>
                    <td className="px-5 py-3 text-xs text-ink-600/70">{sim.scenario.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3"><StatusBadge status={sim.result} /></td>
                    <td className="px-5 py-3 text-xs text-ink-600/50">{formatDateTime(sim.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}