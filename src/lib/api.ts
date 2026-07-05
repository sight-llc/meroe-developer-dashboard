// ─────────────────────────────────────────────────────────────────────────
// Meroe Developer Dashboard — API layer
// Aligned with sight-llc/nombadva development branch (2026-07-04)
//
// BACKEND STATUS:
//   ✅ POST /v1/developers/auth/register|login|refresh
//   ✅ GET|POST /v1/apps
//   ✅ GET|POST /v1/api-keys,  DELETE /v1/api-keys/{id}
//   ✅ POST /v1/customers,  GET /v1/customers,  GET /v1/customers/{id}
//   ✅ GET /v1/customers/{id}/balance
//   ✅ GET /v1/customers/{id}/transactions  (cursor-paginated)
//   ✅ PATCH /v1/customers/{id}/name
//   ✅ PUT /v1/customers/{id}/kyc|suspend|reactivate|close
//   ✅ GET|POST /v1/webhook-subscriptions
//   ✅ DELETE /v1/webhook-subscriptions/{id}
//   ✅ GET|POST /v1/transfers,  POST /v1/transfers/{id}/approve|reject
//   ❌ GET /v1/developers/stats/* (overview stats) — MOCKED
//   ❌ GET /v1/developers/logs   (api logs query) — MOCKED
//   ❌ GET|PATCH /v1/developers/me  (settings) — MOCKED
//   ❌ POST /v1/developers/me/password — MOCKED
//   ❌ POST /v1/developers/me/kyc-documents — MOCKED
//   ❌ PATCH|DELETE /v1/apps/{id} — MOCKED
//   ❌ POST /v1/api-keys/{id}/roll — MOCKED
//   ❌ GET /v1/webhook-subscriptions/{id}/deliveries — MOCKED
//   ❌ POST /v1/webhook-subscriptions/{id}/test — MOCKED
//   ❌ GET /v1/reconciliation/* — MOCKED
//   ❌ GET /v1/sandbox/history — MOCKED
//   ❌ POST /v1/customers/{id}/statements — MOCKED
// ─────────────────────────────────────────────────────────────────────────

import mock from '@/mocks/data.json'
import { tokenStore } from '@/lib/token-store'
import { activeKeyStore } from '@/lib/active-key-store'
import type {
  App, ApiKey, ApiKeyCreated, ApiLogEntry, ApiScope,
  AuthSession, BalanceState, Customer, DeveloperProfile,
  Environment, MisdirectedQueueItem, OutboundTransfer, OverviewStats,
  RecentActivityItem, SandboxScenario, SandboxSimulation, SubAccountType,
  TransactionPage, VolumePoint, WebhookDelivery,
  WebhookSubscription, WebhookSubscriptionCreated, AccountStatus, KycTier,
} from '@/types'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.meroe.dev'

// ── Mock helper ──────────────────────────────────────────────────────────
function mockResolve<T>(data: T, ms = 350): Promise<T> {
  return new Promise((r) => setTimeout(() => r(structuredClone(data as object) as T), ms))
}

// ── Retry-aware fetch ───────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly fieldErrors: { field: string; message: string }[] | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit, auth: 'jwt' | 'apikey' = 'jwt'): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (auth === 'jwt') {
    const token = tokenStore.get()
    if (token) headers['Authorization'] = `Bearer ${token}`
  } else {
    const activeKey = activeKeyStore.get()
    if (activeKey) headers['Authorization'] = `Bearer ${activeKey.rawKey}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init, credentials: 'include', headers,
  })
  if (res.ok) {
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }
  const body = await res.json().catch(() => ({}))
  throw new ApiError(
    body.detail ?? body.message ?? `${res.status} ${res.statusText}`,
    res.status, body.code ?? null, body.errors ?? null,
  )
}

// ── Retry-aware fetch for refresh token (separate from main request) ─────────────
const REFRESH_MAX_RETRIES = 3

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function requestWithRetry<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  let lastError: Error = new Error('Request failed')

  for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init, credentials: 'include', headers,
      })
      if (res.ok) {
        if (res.status === 204) return undefined as T
        return res.json() as Promise<T>
      }
      if (res.status < 500) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(
          body.detail ?? body.message ?? `${res.status} ${res.statusText}`,
          res.status, body.code ?? null, body.errors ?? null,
        )
      }
      const body = await res.json().catch(() => ({}))
      lastError = new ApiError(body.detail ?? `Server error: ${res.status}`, res.status, null, null)
    } catch (e) {
      if (e instanceof ApiError) throw e
      lastError = e instanceof Error ? e : new Error(String(e))
    }
    if (attempt < REFRESH_MAX_RETRIES) await sleep(1000 * Math.pow(2, attempt))
  }
  throw lastError
}

// ── Customer mapper ──────────────────────────────────────────────────────
// Backend CustomerResponse → frontend Customer type
interface BackendCustomerResponse {
  id: string
  appId: string
  externalRef: string
  fullName: string
  email: string
  phone?: string
  bvnMasked?: string
  kycTier: string
  status: string
  createdAt: string
  virtualAccount: {
    id?: string
    accountNumber: string
    bankName: string
    accountName: string
    status: string
  } | null
}

function mapCustomer(raw: BackendCustomerResponse, env: Environment = 'sandbox'): Customer {
  return {
    id: raw.id,
    appId: raw.appId,
    externalRef: raw.externalRef,
    fullName: raw.fullName,
    email: raw.email,
    phone: raw.phone,
    bvnMasked: raw.bvnMasked,
    nuban: raw.virtualAccount?.accountNumber ?? '',
    bankName: raw.virtualAccount?.bankName ?? '',
    virtualAccount: raw.virtualAccount
      ? {
          id: raw.virtualAccount.id,
          accountNumber: raw.virtualAccount.accountNumber,
          bankName: raw.virtualAccount.bankName,
          accountName: raw.virtualAccount.accountName,
          status: raw.virtualAccount.status as Customer['virtualAccount']['status'],
        }
      : { accountNumber: '', bankName: '', accountName: '', status: 'ACTIVE' },
    accountStatus: raw.status as AccountStatus,
    kycTier: raw.kycTier as KycTier,
    environment: env,
    createdAt: raw.createdAt,
    events: [],
  }
}

// ── Transaction mapper ───────────────────────────────────────────────────
// Backend returns cursor-paginated Page<TransactionResponse>
interface BackendTransactionPage {
  items: {
    transactionId: string
    reference: string
    type: string
    direction: 'CREDIT' | 'DEBIT'
    amount: string
    currency: string
    balanceAfter: string
    status: string
    occurredAt: string
  }[]
  nextCursor: string | null
}

function mapTransactionPage(raw: BackendTransactionPage): TransactionPage {
  return {
    content: raw.items.map((t) => ({
      transactionId: t.transactionId,
      reference: t.reference,
      type: t.type,
      direction: t.direction,
      amount: t.amount,
      currency: t.currency,
      balanceAfter: t.balanceAfter,
      status: t.status,
      occurredAt: t.occurredAt,
    })),
    page: 0,
    size: raw.items.length,
    totalElements: raw.items.length,
    totalPages: raw.nextCursor ? 2 : 1,
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────
// POST /v1/developers/auth/login
// Backend returns { accessToken, refreshToken, tokenType, expiresIn } — no developer object.
// We decode the JWT payload to extract developer info.
export async function loginDeveloper(input: { email: string; password: string }): Promise<AuthSession> {
  const res = await request<{ accessToken: string; refreshToken: string; tokenType: string; expiresIn: number }>(
    '/v1/developers/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
  )
  // Decode JWT payload (base64) to extract developer info
  let developer: { id: string; businessName: string; email: string } = {
    id: '',
    businessName: input.email.split('@')[0],
    email: input.email,
  }
  try {
    const payload = JSON.parse(atob(res.accessToken.split('.')[1]))
    developer = {
      id: payload.sub ?? payload.id ?? '',
      businessName: payload.name ?? payload.businessName ?? input.email.split('@')[0],
      email: payload.email ?? input.email,
    }
  } catch {
    // Fallback — use input
  }
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresIn: res.expiresIn,
    developer,
  }
}

// POST /v1/developers/auth/refresh
export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const res = await requestWithRetry<{ accessToken: string; refreshToken: string; tokenType: string; expiresIn: number }>(
    '/v1/developers/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refreshToken }) },
  )
  let developer: { id: string; businessName: string; email: string } = {
    id: '',
    businessName: '',
    email: '',
  }
  try {
    const payload = JSON.parse(atob(res.accessToken.split('.')[1]))
    developer = {
      id: payload.sub ?? payload.id ?? '',
      businessName: payload.name ?? payload.businessName ?? '',
      email: payload.email ?? '',
    }
  } catch {
    // fallback
  }
  return {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    expiresIn: res.expiresIn,
    developer,
  }
}

// POST /v1/developers/auth/register
export async function registerDeveloper(input: { name: string; email: string; company: string; password: string }): Promise<void> {
  await request('/v1/developers/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

// No backend logout endpoint — token cleared client-side only
export async function logoutDeveloper(): Promise<void> {
  tokenStore.clear()
}

// ── Apps ✅ ───────────────────────────────────────────────────────────────
// GET /v1/apps
export async function getApps(): Promise<App[]> {
  return request('/v1/apps')
}

// POST /v1/apps
export async function createApp(input: { name: string; description: string }): Promise<App> {
  return request('/v1/apps', { method: 'POST', body: JSON.stringify(input) })
}

// PATCH /v1/apps/{id} — ❌ NOT in backend yet (MOCKED)
export async function updateApp(id: string, input: { name?: string; description?: string }): Promise<App> {
  const existing = (mock.apps as App[]).find((a) => a.id === id)!
  return mockResolve({ ...existing, ...input }, 300)
}

// DELETE /v1/apps/{id} — ❌ NOT in backend yet (MOCKED)
export async function deactivateApp(id: string): Promise<void> {
  await mockResolve(undefined, 300)
  void id
}

// ── API Keys ✅ ───────────────────────────────────────────────────────────
// GET /v1/api-keys  (developer JWT)
export async function getApiKeys(appId?: string): Promise<ApiKey[]> {
  const keys = await request<ApiKey[]>('/v1/api-keys')
  if (appId) return keys.filter((k) => k.appId === appId)
  return keys
}

// POST /v1/api-keys  { appId, scopes, readOnly }
export async function createApiKey(input: { appId: string; scopes: ApiScope[] }): Promise<ApiKeyCreated> {
  const res = await request<{ id: string; rawKey: string; keyPrefix: string; lastFour: string; environment: string; scopes: string[]; warning: string }>(
    '/v1/api-keys',
    { method: 'POST', body: JSON.stringify({ appId: input.appId, scopes: input.scopes, readOnly: false }) },
  )
  return {
    id: res.id,
    appId: input.appId,
    keyPrefix: res.keyPrefix,
    lastFour: res.lastFour,
    scopes: res.scopes as ApiScope[],
    status: 'ACTIVE' as const,
    environment: res.environment as Environment,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    rawKey: res.rawKey,
  }
}

// DELETE /v1/api-keys/{id}  → 204 No Content
export async function revokeApiKey(id: string): Promise<void> {
  return request(`/v1/api-keys/${id}`, { method: 'DELETE' })
}

// Roll = revoke + create — ❌ no backend roll endpoint (MOCKED)
export async function rollApiKey(id: string): Promise<ApiKeyCreated> {
  const existing = (mock.apiKeys as ApiKey[]).find((k) => k.id === id)
  const prefix = `nv_test_sk_${Math.random().toString(16).slice(2, 10)}`
  const lastFour = Math.random().toString(16).slice(2, 6)
  return mockResolve({
    id, appId: existing?.appId ?? '', appName: existing?.appName,
    keyPrefix: prefix, lastFour,
    scopes: existing?.scopes ?? [], status: 'ACTIVE' as const,
    environment: existing?.environment ?? 'sandbox',
    createdAt: new Date().toISOString(), revokedAt: null,
    rawKey: `${prefix}${Math.random().toString(16).slice(2, 34)}`,
  }, 500)
}

// ── Customers ✅ ──────────────────────────────────────────────────────────
// GET /v1/customers  (API key auth — app-scoped, optional q param for search)
export async function getCustomers(params?: { appId?: string; search?: string; status?: string }): Promise<Customer[]> {
  const query: Record<string, string> = {}
  if (params?.search) query['q'] = params.search
  const qs = Object.keys(query).length ? `?${new URLSearchParams(query).toString()}` : ''
  const raw = await request<BackendCustomerResponse[]>(`/v1/customers${qs}`, undefined, 'apikey')
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  let results = raw.map((c) => mapCustomer(c, env))
  // Client-side filters (backend doesn't support appId/status filtering)
  if (params?.appId && params.appId !== 'ALL') results = results.filter((c) => c.appId === params.appId)
  if (params?.status && params.status !== 'ALL') results = results.filter((c) => c.accountStatus === params.status)
  return results
}

// GET /v1/customers/{id}  (API key auth)
export async function getCustomer(id: string): Promise<Customer | undefined> {
  const raw = await request<BackendCustomerResponse>(`/v1/customers/${id}`, undefined, 'apikey')
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// GET /v1/customers/{id}/balance  (API key auth)
export async function getCustomerBalance(id: string): Promise<BalanceState> {
  return request(`/v1/customers/${id}/balance`, undefined, 'apikey')
}

// GET /v1/customers/{id}/transactions  (cursor-paginated, API key auth)
export async function getCustomerTransactions(id: string, _page = 0, _size = 20): Promise<TransactionPage> {
  const raw = await request<BackendTransactionPage>(
    `/v1/customers/${id}/transactions?limit=${_size}`,
    undefined,
    'apikey',
  )
  return mapTransactionPage(raw)
}

// PATCH /v1/customers/{id}/name  { fullName }
export async function renameCustomer(id: string, fullName: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/name`,
    { method: 'PATCH', body: JSON.stringify({ fullName }) },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// PUT /v1/customers/{id}/kyc  { kycTier }
export async function changeKycTier(id: string, kycTier: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/kyc`,
    { method: 'PUT', body: JSON.stringify({ kycTier }) },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// PUT /v1/customers/{id}/suspend  { reason }
export async function suspendCustomer(id: string, reason: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/suspend`,
    { method: 'PUT', body: JSON.stringify({ reason }) },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// PUT /v1/customers/{id}/reactivate
export async function reactivateCustomer(id: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/reactivate`,
    { method: 'PUT' },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// PUT /v1/customers/{id}/close  — irreversible
export async function closeCustomer(id: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/close`,
    { method: 'PUT' },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// POST /v1/customers/{id}/statements — ❌ NOT built yet (MOCKED)
export async function downloadStatement(customerId: string, format: 'pdf' | 'csv'): Promise<{ url: string }> {
  return mockResolve({ url: `https://files.meroe.dev/mock-statement-${customerId}.${format}` }, 600)
}

// ── Webhook Subscriptions ✅ ───────────────────────────────────────────────
// GET /v1/webhook-subscriptions
export async function getWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  return request('/v1/webhook-subscriptions')
}

// POST /v1/webhook-subscriptions  { url, eventTypes }
export async function createWebhookSubscription(input: { url: string; eventTypes: string[] }): Promise<WebhookSubscriptionCreated> {
  const res = await request<{ id: string; url: string; eventTypes: string[]; status: string; environment: string; createdAt: string; secret: string; warning: string }>(
    '/v1/webhook-subscriptions',
    { method: 'POST', body: JSON.stringify(input) },
  )
  return {
    id: res.id,
    url: res.url,
    eventTypes: res.eventTypes,
    status: res.status as WebhookSubscription['status'],
    environment: res.environment as Environment,
    createdAt: res.createdAt,
    secret: res.secret,
    warning: res.warning,
  }
}

// DELETE /v1/webhook-subscriptions/{id}  → 204 No Content
export async function deleteWebhookSubscription(id: string): Promise<void> {
  return request(`/v1/webhook-subscriptions/${id}`, { method: 'DELETE' })
}

// POST /v1/webhook-subscriptions/{id}/test — ❌ NOT in backend yet (MOCKED)
export async function testWebhookSubscription(id: string): Promise<{ delivered: boolean }> {
  await new Promise((r) => setTimeout(r, 600))
  void id
  return { delivered: true }
}

// GET /v1/webhook-subscriptions/{id}/deliveries — ❌ NOT in backend yet (MOCKED)
export async function getWebhookDeliveries(subscriptionId: string): Promise<WebhookDelivery[]> {
  return mockResolve((mock.webhookDeliveries as WebhookDelivery[]).filter((d) => d.subscriptionId === subscriptionId))
}

// ── Reconciliation ❌ NO BACKEND (MOCKED) ─────────────────────────────────
export async function getReconciliationSummary(): Promise<{ matched: number; unmatched: number; misdirected: number }> {
  return mockResolve({ matched: mock.reconciliation.matched, unmatched: mock.reconciliation.unmatched, misdirected: mock.reconciliation.misdirected })
}

export async function getMisdirectedQueue(): Promise<MisdirectedQueueItem[]> {
  return mockResolve(mock.reconciliation.misdirectedQueue as MisdirectedQueueItem[])
}

export async function confirmCorrect(txId: string): Promise<{ txId: string; status: 'MATCHED' }> {
  return mockResolve({ txId, status: 'MATCHED' as const }, 400)
}

export async function initiateRefund(txId: string): Promise<{ txId: string; status: 'REFUNDED' }> {
  return mockResolve({ txId, status: 'REFUNDED' as const }, 500)
}

// ── API Logs ❌ NO BACKEND (MOCKED) ────────────────────────────────────────
export async function getApiLogs(params?: { statusCode?: string; environment?: Environment; path?: string }): Promise<ApiLogEntry[]> {
  let results = mock.apiLogs as ApiLogEntry[]
  if (params?.environment) results = results.filter((l) => l.environment === params.environment)
  if (params?.path) results = results.filter((l) => l.path.includes(params.path!))
  if (params?.statusCode === '2xx') results = results.filter((l) => l.statusCode < 300)
  if (params?.statusCode === '4xx') results = results.filter((l) => l.statusCode >= 400 && l.statusCode < 500)
  if (params?.statusCode === '5xx') results = results.filter((l) => l.statusCode >= 500)
  return mockResolve(results)
}

// ── Overview ❌ NO BACKEND (MOCKED) ────────────────────────────────────────
export async function getOverviewStats(): Promise<OverviewStats> {
  return mockResolve(mock.overviewStats as OverviewStats)
}

export async function getVolumeSeries(days = 30): Promise<VolumePoint[]> {
  return mockResolve((mock.volumeSeries30d as VolumePoint[]).slice(-days))
}

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  return mockResolve(mock.recentActivity as RecentActivityItem[])
}

// ── Sandbox ❌ NO BACKEND (MOCKED) ─────────────────────────────────────────
export async function getSandboxHistory(): Promise<SandboxSimulation[]> {
  return mockResolve(mock.sandboxHistory as SandboxSimulation[])
}

// ── Outbound Transfers ◐ SCAFFOLDED ───────────────────────────────────────
// GET /v1/transfers  (API key auth, scope: transfers:read)
export async function getOutboundTransfers(params?: { status?: string; environment?: Environment }): Promise<OutboundTransfer[]> {
  const raw = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }[]>('/v1/transfers', undefined, 'apikey')
  let results = raw.map((t) => ({
    id: t.id,
    appId: '',
    customerId: t.customerId,
    sourceSubAccount: t.sourceSubAccount as SubAccountType,
    amount: t.amount,
    fee: t.fee === '0' ? null : t.fee,
    destinationAccountNumber: t.destinationAccountNumber,
    destinationBankCode: t.destinationBankCode,
    destinationAccountName: t.destinationAccountName,
    narration: '',
    merchantTxRef: t.merchantTxRef,
    nombaTransferId: t.nombaTransferId,
    status: t.status as OutboundTransfer['status'],
    environment: t.environment as Environment,
    createdAt: t.createdAt,
    submittedAt: t.submittedAt,
    completedAt: t.completedAt,
    failureReason: t.failureReason,
  })) as OutboundTransfer[]
  if (params?.status && params.status !== 'ALL') results = results.filter((t) => t.status === params.status)
  if (params?.environment) results = results.filter((t) => t.environment === params.environment)
  return results
}

// POST /v1/transfers  (API key auth, scope: transfers:write)
// Backend requires customerId (debits from that customer's wallet)
export async function initiateTransfer(input: {
  appId: string
  customerId: string
  sourceSubAccount: SubAccountType
  destinationAccountNumber: string
  destinationBankCode: string
  destinationAccountName: string
  amount: string
  fee?: string
  narration: string
  merchantTxRef: string
}): Promise<OutboundTransfer> {
  const body: Record<string, unknown> = {
    customerId: input.customerId,
    sourceSubAccount: input.sourceSubAccount,
    amount: input.amount,
    destinationBankCode: input.destinationBankCode,
    destinationAccountNumber: input.destinationAccountNumber,
    destinationAccountName: input.destinationAccountName,
    narration: input.narration,
    merchantTxRef: input.merchantTxRef,
  }
  if (input.fee) body.fee = input.fee
  const res = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }>('/v1/transfers', { method: 'POST', body: JSON.stringify(body) }, 'apikey')
  return {
    id: res.id,
    appId: input.appId,
    customerId: res.customerId,
    sourceSubAccount: res.sourceSubAccount as SubAccountType,
    amount: res.amount,
    fee: res.fee === '0' ? null : res.fee,
    destinationAccountNumber: res.destinationAccountNumber,
    destinationBankCode: res.destinationBankCode,
    destinationAccountName: res.destinationAccountName,
    narration: input.narration,
    merchantTxRef: res.merchantTxRef,
    nombaTransferId: res.nombaTransferId,
    status: res.status as OutboundTransfer['status'],
    environment: res.environment as Environment,
    createdAt: res.createdAt,
    submittedAt: res.submittedAt,
    completedAt: res.completedAt,
    failureReason: res.failureReason,
  }
}

// POST /v1/transfers/{id}/approve  (developer JWT — dashboard action)
export async function approveTransfer(id: string): Promise<OutboundTransfer> {
  const res = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }>(`/v1/transfers/${id}/approve`, { method: 'POST' })
  return {
    id: res.id, appId: '', customerId: res.customerId,
    sourceSubAccount: res.sourceSubAccount as SubAccountType,
    amount: res.amount, fee: res.fee === '0' ? null : res.fee,
    destinationAccountNumber: res.destinationAccountNumber,
    destinationBankCode: res.destinationBankCode,
    destinationAccountName: res.destinationAccountName,
    narration: '', merchantTxRef: res.merchantTxRef,
    nombaTransferId: res.nombaTransferId,
    status: res.status as OutboundTransfer['status'],
    environment: res.environment as Environment,
    createdAt: res.createdAt, submittedAt: res.submittedAt,
    completedAt: res.completedAt, failureReason: res.failureReason,
  }
}

// POST /v1/transfers/{id}/reject  (developer JWT — dashboard action)
export async function rejectTransfer(id: string, reason?: string): Promise<OutboundTransfer> {
  const res = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }>(`/v1/transfers/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
  return {
    id: res.id, appId: '', customerId: res.customerId,
    sourceSubAccount: res.sourceSubAccount as SubAccountType,
    amount: res.amount, fee: res.fee === '0' ? null : res.fee,
    destinationAccountNumber: res.destinationAccountNumber,
    destinationBankCode: res.destinationBankCode,
    destinationAccountName: res.destinationAccountName,
    narration: '', merchantTxRef: res.merchantTxRef,
    nombaTransferId: res.nombaTransferId,
    status: res.status as OutboundTransfer['status'],
    environment: res.environment as Environment,
    createdAt: res.createdAt, submittedAt: res.submittedAt,
    completedAt: res.completedAt, failureReason: res.failureReason,
  }
}

// ── Settings ❌ NO BACKEND (MOCKED) ────────────────────────────────────────
export async function getDeveloperProfile(): Promise<DeveloperProfile> {
  return mockResolve(mock.developerProfile as DeveloperProfile)
}

export async function updateDeveloperProfile(input: Partial<Pick<DeveloperProfile, 'businessName' | 'email' | 'phone'>>): Promise<DeveloperProfile> {
  return mockResolve({ ...(mock.developerProfile as DeveloperProfile), ...input }, 400)
}

export async function uploadKycDocuments(): Promise<{ kycStatus: 'PENDING' }> {
  return mockResolve({ kycStatus: 'PENDING' as const }, 800)
}

export async function changePassword(_input: { currentPassword: string; newPassword: string }): Promise<{ success: true }> {
  return mockResolve({ success: true as const }, 500)
}