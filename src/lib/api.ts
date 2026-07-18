// ─────────────────────────────────────────────────────────────────────────
// Meroe Developer Dashboard — API layer
// Aligned with sight-llc/nombadva development branch (2026-07-17)
//
// BACKEND STATUS:
//   ✅ POST /v1/developers/auth/register|login|refresh
//   ✅ GET|POST /v1/apps  (environment via X-Environment header)
//   ✅ PATCH|DELETE /v1/apps/{id}
//   ✅ GET|POST /v1/api-keys  (environment via X-Environment header)
//   ✅ DELETE /v1/api-keys/{id}
//   ✅ POST /v1/api-keys/{id}/roll
//   ✅ POST /v1/customers,  GET /v1/customers,  GET /v1/customers/{id}
//   ✅ GET /v1/customers/{id}/balance
//   ✅ GET /v1/customers/{id}/transactions  (cursor-paginated)
//   ✅ PATCH /v1/customers/{id}/name
//   ✅ PUT /v1/customers/{id}/kyc|suspend|reactivate|close
//   ✅ GET /v1/customers/{id}/statements
//   ✅ POST /v1/customers/{id}/kyc-documents
//   ✅ GET|POST /v1/webhook-subscriptions
//   ✅ DELETE /v1/webhook-subscriptions/{id}
//   ✅ GET|POST /v1/webhook-subscriptions/{id}/deliveries
//   ✅ POST /v1/webhook-subscriptions/{id}/test
//   ✅ GET|POST /v1/transfers,  POST /v1/transfers/{id}/approve|reject|reconcile
//   ✅ POST /v1/transfers/internal
//   ✅ GET /v1/transfers/banks
//   ✅ POST /v1/transfers/bank/lookup
//   ✅ GET /v1/developers/stats/* (overview, volume, activity)
//   ✅ GET /v1/developers/logs
//   ✅ GET|PATCH /v1/developers/me
//   ✅ POST /v1/developers/me/transaction-pin
//   ✅ PUT /v1/developers/me/password
//   ✅ POST /v1/developers/me/kyc-documents/upload  (multipart)
//   ✅ POST /v1/developers/me/kyc-documents
//   ✅ GET /v1/fees/quote
//   ✅ GET /v1/reconciliation/summary
//   ✅ POST /v1/reconciliation/{txId}/refund
//   ✅ GET /v1/payments  (cursor-paginated)
// ─────────────────────────────────────────────────────────────────────────

import mock from '@/mocks/data.json'
import { tokenStore } from '@/lib/token-store'
import { activeKeyStore } from '@/lib/active-key-store'
import { envStore } from '@/lib/env-store'
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
    if (!headers['X-Environment']) {
      const env = envStore.get()
      if (env === 'live') headers['X-Environment'] = 'live'
    }
  } else {
    const activeKey = activeKeyStore.get()
    if (activeKey) headers['Authorization'] = `Bearer ${activeKey.rawKey}`
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init, headers,
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
        ...init, headers,
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

// POST /v1/developers/auth/logout — revokes the refresh token server-side
export async function logoutDeveloper(): Promise<void> {
  const refreshToken = tokenStore.getRefreshToken()
  if (refreshToken) {
    try {
      await request('/v1/developers/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // Server-side revocation is best-effort; always clear local tokens
    }
  }
  tokenStore.clear()
}

// ── Apps ✅ ───────────────────────────────────────────────────────────────
// GET /v1/apps
export async function getApps(): Promise<App[]> {
  return request('/v1/apps')
}

// POST /v1/apps
export async function createApp(input: { name: string; description: string }, extraHeaders?: Record<string, string>): Promise<App> {
  return request('/v1/apps', { method: 'POST', body: JSON.stringify(input), headers: extraHeaders })
}

// PATCH /v1/apps/{id} — ✅ Available
export async function updateApp(id: string, input: { name?: string; description?: string }): Promise<App> {
  return request(`/v1/apps/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

// DELETE /v1/apps/{id} — ✅ Available
export async function deactivateApp(id: string): Promise<void> {
  return request(`/v1/apps/${id}`, { method: 'DELETE' })
}

// ── API Keys ✅ ───────────────────────────────────────────────────────────
// GET /v1/api-keys  (developer JWT)
export async function getApiKeys(appId?: string): Promise<ApiKey[]> {
  const keys = await request<ApiKey[]>('/v1/api-keys')
  if (appId) return keys.filter((k) => k.appId === appId)
  return keys
}

// POST /v1/api-keys  { appId, scopes, readOnly }
export async function createApiKey(input: { appId: string; scopes: ApiScope[] }, extraHeaders?: Record<string, string>): Promise<ApiKeyCreated> {
  const res = await request<{ id: string; rawKey: string; keyPrefix: string; lastFour: string; environment: string; scopes: string[]; warning: string }>(
    '/v1/api-keys',
    { method: 'POST', body: JSON.stringify({ appId: input.appId, scopes: input.scopes, readOnly: false }), headers: extraHeaders },
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

// POST /v1/api-keys/{id}/roll — ✅ Available
export async function rollApiKey(id: string): Promise<ApiKeyCreated> {
  const res = await request<{
    id: string
    rawKey: string
    keyPrefix: string
    lastFour: string
    environment: string
    scopes: string[]
    warning: string
  }>(`/v1/api-keys/${id}/roll`, { method: 'POST' })
  return {
    id: res.id,
    appId: '',
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

// PUT /v1/customers/{id}/reactivate  — now requires a note field
export async function reactivateCustomer(id: string, note?: string): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/reactivate`,
    { method: 'PUT', body: JSON.stringify({ note: note ?? 'Reactivated via dashboard' }) },
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

// GET /v1/customers/{id}/statements — ✅ Available
export async function downloadStatement(customerId: string, format: 'pdf' | 'csv', from?: string, to?: string): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams({ format })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const headers: Record<string, string> = {}
  const activeKey = activeKeyStore.get()
  if (activeKey) headers['Authorization'] = `Bearer ${activeKey.rawKey}`

  const res = await fetch(`${API_BASE_URL}/v1/customers/${customerId}/statements?${params.toString()}`, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.message ?? `Download failed (${res.status})`, res.status, body?.code ?? null, null)
  }

  const mime = format === 'pdf' ? 'application/pdf' : 'text/csv'
  const ext = format === 'pdf' ? 'pdf' : 'csv'
  const blob = await res.blob()
  const filename = `statement-${customerId}.${ext}`
  return { blob: new Blob([blob], { type: mime }), filename }
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

// POST /v1/webhook-subscriptions/{id}/test — ✅ Available
export async function testWebhookSubscription(id: string): Promise<WebhookDelivery> {
  const raw = await request<{
    id: string
    subscriptionId: string
    eventType: string
    status: string
    attemptCount: number
    nextRetryAt?: string
    createdAt: string
  }>(`/v1/webhook-subscriptions/${id}/test`, { method: 'POST' })
  return {
    id: raw.id,
    subscriptionId: raw.subscriptionId,
    eventType: raw.eventType,
    status: raw.status as WebhookDelivery['status'],
    attemptCount: raw.attemptCount,
    nextRetryAt: raw.nextRetryAt,
    responseCode: null,
    latencyMs: null,
    createdAt: raw.createdAt,
  }
}

// GET /v1/webhook-subscriptions/{id}/deliveries — ✅ Available
export async function getWebhookDeliveries(subscriptionId: string): Promise<WebhookDelivery[]> {
  const raw = await request<{
    id: string
    subscriptionId: string
    eventType: string
    status: string
    attemptCount: number
    nextRetryAt?: string
    createdAt: string
  }[]>(`/v1/webhook-subscriptions/${subscriptionId}/deliveries`)
  return raw.map((d) => ({
    id: d.id,
    subscriptionId: d.subscriptionId,
    eventType: d.eventType,
    status: d.status as WebhookDelivery['status'],
    attemptCount: d.attemptCount,
    nextRetryAt: d.nextRetryAt,
    responseCode: null, // Not in response
    latencyMs: null, // Not in response
    createdAt: d.createdAt,
  }))
}

// ── Reconciliation ✅ ───────────────────────────────────────────────────────
// GET /v1/reconciliation/summary
// Backend returns: { total, matched, misdirected, recovered, otherCredited, byOutcome }
// byOutcome contains keyed buckets with the raw counts — extract unmatched from it
export async function getReconciliationSummary(): Promise<{ matched: number; unmatched: number; misdirected: number }> {
  const raw = await request<{
    total: number
    matched: number
    misdirected: number
    recovered: number
    otherCredited: number
    byOutcome: Record<string, number>
  }>('/v1/reconciliation/summary')
  // Extract unmatched from the byOutcome map — any outcome not matched/misdirected/recovered
  const accounted = (raw.byOutcome?.MATCHED ?? raw.matched) + (raw.byOutcome?.MISDIRECTED ?? raw.misdirected) + (raw.byOutcome?.RECOVERED ?? raw.recovered)
  const total = raw.byOutcome ? Object.values(raw.byOutcome).reduce((a, b) => a + b, 0) : raw.total
  return {
    matched: raw.matched,
    unmatched: raw.byOutcome ? total - accounted : raw.otherCredited,
    misdirected: raw.misdirected,
  }
}

// GET /v1/misdirected-payments
export async function getMisdirectedQueue(): Promise<MisdirectedQueueItem[]> {
  const raw = await request<{
    id: string
    inboundPaymentId: string
    receivedByCustomerId: string | null
    flagReason: string
    amount: string
    senderName: string
    senderBank: string
    occurredAt: string
  }[]>('/v1/misdirected-payments')
  return raw.map((m) => ({
    transactionId: m.inboundPaymentId,
    customerId: m.receivedByCustomerId ?? '',
    customerName: '', // Would need to join from customers
    senderName: m.senderName,
    senderBank: m.senderBank,
    amount: m.amount,
    flagReason: m.flagReason as MisdirectedQueueItem['flagReason'],
    detectedAt: m.occurredAt,
  }))
}

// POST /v1/misdirected-payments/{id}/resolve
export async function confirmCorrect(txId: string): Promise<{ txId: string; status: 'MATCHED' }> {
  await request(`/v1/misdirected-payments/${txId}/resolve`, { method: 'POST' })
  return { txId, status: 'MATCHED' as const }
}

// POST /v1/reconciliation/{txId}/refund — CTO/CEO_OWNER + transaction PIN required
export async function initiateRefund(txId: string, transactionPin?: string): Promise<{ txId: string; status: string }> {
  const headers: Record<string, string> = {}
  if (transactionPin) headers['X-Transaction-Pin'] = transactionPin
  return request(`/v1/reconciliation/${txId}/refund`, {
    method: 'POST',
    headers,
  })
}

// ── API Logs ✅ ─────────────────────────────────────────────────────────────
// GET /v1/developers/logs
export async function getApiLogs(params?: { statusCode?: string; environment?: Environment; path?: string }): Promise<ApiLogEntry[]> {
  const raw = await request<{
    id: string
    method: string
    path: string
    status: number
    latencyMs: number
    environment: string
    createdAt: string
  }[]>('/v1/developers/logs')
  let results = raw.map((l) => ({
    id: l.id,
    method: l.method as ApiLogEntry['method'],
    path: l.path,
    statusCode: l.status,
    latencyMs: l.latencyMs,
    environment: l.environment as Environment,
    timestamp: l.createdAt,
    requestBody: null,
    responseBody: null,
  }))
  // Client-side filters
  if (params?.path) results = results.filter((l) => l.path.includes(params.path!))
  if (params?.statusCode === '2xx') results = results.filter((l) => l.statusCode < 300)
  if (params?.statusCode === '4xx') results = results.filter((l) => l.statusCode >= 400 && l.statusCode < 500)
  if (params?.statusCode === '5xx') results = results.filter((l) => l.statusCode >= 500)
  return results
}

// ── Overview ✅ ─────────────────────────────────────────────────────────────
// GET /v1/developers/stats/overview
export async function getOverviewStats(): Promise<OverviewStats> {
  return request<{
    customers: number
    apps: number
    activeApiKeys: number
    activeWebhookSubscriptions: number
    inboundCount: number
    inboundVolume: string
    payoutCount: number
    payoutVolume: string
  }>('/v1/developers/stats/overview')
}

// GET /v1/developers/stats/volume
export async function getVolumeSeries(days = 30): Promise<VolumePoint[]> {
  const raw = await request<{ date: string; inboundCount: number; inboundVolume: string }[]>(
    `/v1/developers/stats/volume?days=${days}`,
  )
  return raw.map((p) => ({
    date: p.date,
    volumeNgn: parseFloat(p.inboundVolume),
  }))
}

// GET /v1/developers/stats/activity
export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  return request<{
    occurredAt: string
    kind: 'PAYOUT' | 'INBOUND'
    counterparty: string
    narration: string
    amount: number
    status: string
  }[]>('/v1/developers/stats/activity')
}

// ── Received Payments ✅ ───────────────────────────────────────────────────
// GET /v1/payments  (API key auth, scope: payments:read)
// Now cursor-paginated (limit + cursor params)
interface BackendPaymentPage {
  items: {
    id: string
    customerId: string | null
    virtualAccountId: string | null
    amount: string
    fee: string
    senderName: string
    senderAccount: string
    senderBank: string
    narration: string
    reconOutcome: string
    occurredAt: string
  }[]
  nextCursor: string | null
}
export async function getReceivedPayments(limit = 20, cursor?: string): Promise<{
  payments: {
    id: string
    customerId: string | null
    virtualAccountId: string | null
    amount: string
    fee: string
    senderName: string
    senderAccount: string
    senderBank: string
    narration: string
    reconOutcome: string
    occurredAt: string
  }[]
  nextCursor: string | null
}> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const raw = await request<BackendPaymentPage>(`/v1/payments?${params.toString()}`, undefined, 'apikey')
  return {
    payments: raw.items,
    nextCursor: raw.nextCursor,
  }
}

// ── Fee Quote ✅ ─────────────────────────────────────────────────────────────
// GET /v1/fees/quote?direction=INBOUND|OUTBOUND&amount=X
export async function getFeeQuote(direction: 'INBOUND' | 'OUTBOUND', amount: string): Promise<{
  direction: string
  amount: string
  fee: string
  netAmount: string
}> {
  return request(`/v1/fees/quote?direction=${direction}&amount=${amount}`)
}

// ── Customer KYC Documents ✅ ───────────────────────────────────────────────
// POST /v1/customers/{id}/kyc-documents  { bvn, documentReferences }
export async function submitCustomerKycDocuments(id: string, input: { bvn?: string; documentReferences: string[] }): Promise<Customer> {
  const raw = await request<BackendCustomerResponse>(
    `/v1/customers/${id}/kyc-documents`,
    { method: 'POST', body: JSON.stringify(input) },
    'apikey',
  )
  const env = activeKeyStore.get()?.environment ?? 'sandbox'
  return mapCustomer(raw, env)
}

// ── Sandbox ✅ ─────────────────────────────────────────────────────────────
// GET /v1/sandbox/history
export async function getSandboxHistory(): Promise<SandboxSimulation[]> {
  const raw = await request<{
    id: string
    virtualAccountId: string
    customerName: string
    amount: string
    senderName: string
    senderBank: string
    scenario: string
    result: string
    createdAt: string
  }[]>('/v1/sandbox/history')
  return raw.map((s) => ({
    id: s.id,
    virtualAccountId: s.virtualAccountId,
    customerName: s.customerName,
    amount: s.amount,
    senderName: s.senderName,
    senderBank: s.senderBank,
    scenario: s.scenario as SandboxSimulation['scenario'],
    result: s.result as SandboxSimulation['result'],
    createdAt: s.createdAt,
  }))
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
// Now requires X-Transaction-Pin header for money-release gating
export async function approveTransfer(id: string, transactionPin?: string): Promise<OutboundTransfer> {
  const headers: Record<string, string> = {}
  if (transactionPin) {
    headers['X-Transaction-Pin'] = transactionPin
  }
  const res = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }>(`/v1/transfers/${id}/approve`, { method: 'POST', headers })
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

// POST /v1/transfers/parent  (API key auth, scope: transfers:write)
// Routes through the platform parent account pool instead of merchant sub-account
export async function initiateParentTransfer(input: {
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
  }>('/v1/transfers/parent', { method: 'POST', body: JSON.stringify(body) }, 'apikey')
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

// POST /v1/transfers/{id}/reconcile  (API key auth)
export async function reconcileTransfer(id: string): Promise<OutboundTransfer> {
  const res = await request<{
    id: string; customerId: string | null; sourceSubAccount: string;
    amount: string; fee: string; destinationBankCode: string;
    destinationAccountNumber: string; destinationAccountName: string;
    merchantTxRef: string; nombaTransferId: string | null;
    status: string; environment: string; createdAt: string;
    submittedAt: string | null; completedAt: string | null; failureReason: string | null;
  }>(`/v1/transfers/${id}/reconcile`, { method: 'POST' }, 'apikey')
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

// ── Internal Transfer ✅ ─────────────────────────────────────────────────────
// POST /v1/transfers/internal  (API key auth, scope: transfers:write)
// Move funds between two of your own customers (VA→VA) — a pure ledger transfer, no Nomba/NIP.
export async function internalTransfer(input: {
  fromCustomerId: string
  toCustomerId: string
  amount: string
  narration: string
  merchantTxRef: string
}): Promise<{
  id: string
  fromCustomerId: string
  toCustomerId: string
  amount: string
  narration: string
  merchantTxRef: string
  status: string
  createdAt: string
}> {
  return request('/v1/transfers/internal', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 'apikey')
}

// ── Bank Lookup ✅ ───────────────────────────────────────────────────────────
// GET /v1/transfers/banks
export async function getBanks(): Promise<{ bankCode: string; bankName: string; nipCode?: string; logo?: string }[]> {
  return request('/v1/transfers/banks', undefined, 'apikey')
}

// POST /v1/transfers/bank/lookup
export async function lookupBankAccount(input: { accountNumber: string; bankCode: string }): Promise<{ accountNumber: string; accountName: string }> {
  return request('/v1/transfers/bank/lookup', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 'apikey')
}

// ── Settings ✅ ─────────────────────────────────────────────────────────────
// GET /v1/developers/me
export async function getDeveloperProfile(): Promise<DeveloperProfile> {
  const raw = await request<{
    id: string
    name: string
    email: string
    company: string
    liveEnabled: boolean
    status: string
    hasTransactionPin: boolean
    verificationStatus: string
    createdAt: string
  }>('/v1/developers/me')
  return {
    businessName: raw.name,
    email: raw.email,
    phone: '', // Not in backend response
    company: raw.company,
    kycStatus: raw.verificationStatus as DeveloperProfile['kycStatus'],
    verificationStatus: raw.verificationStatus as DeveloperProfile['verificationStatus'],
    liveEnabled: raw.liveEnabled,
    hasTransactionPin: raw.hasTransactionPin,
  }
}

// POST /v1/developers/me/transaction-pin — ✅ Available
export async function setTransactionPin(pin: string, currentPassword: string): Promise<void> {
  await request('/v1/developers/me/transaction-pin', {
    method: 'POST',
    body: JSON.stringify({ pin, currentPassword }),
  })
}

// PATCH /v1/developers/me
export async function updateDeveloperProfile(input: Partial<Pick<DeveloperProfile, 'businessName' | 'email' | 'phone' | 'company'>>): Promise<DeveloperProfile> {
  const raw = await request<{
    id: string
    name: string
    email: string
    company: string
    liveEnabled: boolean
    status: string
    hasTransactionPin: boolean
    verificationStatus: string
    createdAt: string
  }>('/v1/developers/me', {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.businessName !== undefined && { name: input.businessName }),
      ...(input.company !== undefined && { company: input.company }),
    }),
  })
  return {
    businessName: raw.name,
    email: raw.email,
    phone: input.phone ?? '',
    company: raw.company,
    kycStatus: raw.verificationStatus as DeveloperProfile['kycStatus'],
    verificationStatus: raw.verificationStatus as DeveloperProfile['verificationStatus'],
    liveEnabled: raw.liveEnabled,
    hasTransactionPin: raw.hasTransactionPin,
  }
}

// POST /v1/developers/me/kyc-documents/upload — multipart file upload
export async function uploadKycDocumentFile(file: File): Promise<{ documentId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return request('/v1/developers/me/kyc-documents/upload', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type with boundary
  })
}

// POST /v1/developers/me/kyc-documents — submit document references for KYC review
export async function submitDeveloperKycDocuments(documentReferences: string[]): Promise<DeveloperProfile> {
  const raw = await request<{
    id: string; name: string; email: string; company: string;
    liveEnabled: boolean; status: string; hasTransactionPin: boolean;
    verificationStatus: string; createdAt: string
  }>('/v1/developers/me/kyc-documents', {
    method: 'POST',
    body: JSON.stringify({ documentReferences }),
  })
  return {
    businessName: raw.name,
    email: raw.email,
    phone: '',
    company: raw.company,
    kycStatus: raw.verificationStatus as DeveloperProfile['kycStatus'],
    verificationStatus: raw.verificationStatus as DeveloperProfile['verificationStatus'],
    liveEnabled: raw.liveEnabled,
    hasTransactionPin: raw.hasTransactionPin,
  }
}

// PUT /v1/developers/me/password
export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ success: true }> {
  await request('/v1/developers/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword: input.currentPassword, newPassword: input.newPassword }),
  })
  return { success: true as const }
}
