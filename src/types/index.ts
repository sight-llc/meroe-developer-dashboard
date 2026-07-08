// ─────────────────────────────────────────────────────────────────────────
// Meroe — shared domain types
// Aligned with development branch (sight-llc/nombadva, 2026-07-04):
//   - App.status string (ACTIVE/SUSPENDED), no active boolean, has slug
//   - ApiKey: keyPrefix, lastFour, rawKey on create, ACTIVE/REVOKED uppercase
//   - BalanceState: 4 real fields only (available, spendable, inflightDebit, currency)
//   - Transaction: real API shape — transactionId, direction, occurredAt, balanceAfter
//   - Customer: externalRef + bvnMasked added; balance/transactions separate fetches
//   - OutboundTransfer: fee, nombaTransferId, submittedAt, failureReason; destinationAccountName required
//   - WebhookSubscription: no deliveryRate/lastDeliveredAt; eventTypes plain strings; secret on create
//   - Scopes: transfers:read, transfers:write added
// ─────────────────────────────────────────────────────────────────────────

export type Environment = 'sandbox' | 'live'

export type ApiScope =
  | 'customers:read'
  | 'customers:write'
  | 'accounts:read'
  | 'accounts:write'
  | 'transactions:read'
  | 'reconciliation:read'
  | 'reconciliation:write'
  | 'transfers:read'
  | 'transfers:write'
  | 'webhooks:manage'
  | 'reports:read'

// ── Apps ──────────────────────────────────────────────────────────────────
// Matches AppResponse { id, name, description, slug, status, environment, createdAt }
export interface App {
  id: string
  developerId: string
  name: string
  description: string
  slug: string
  status: 'ACTIVE' | 'SUSPENDED'
  environment: Environment
  createdAt: string
}

// ── API Keys ───────────────────────────────────────────────────────────────
// Matches ApiKeyResponse { id, appId, keyPrefix, lastFour, scopes, status, environment, createdAt, revokedAt }
// appName is client-side only (joined from apps for display — not returned by API)
// No `name` field on the backend
export interface ApiKey {
  id: string
  appId: string
  appName?: string
  keyPrefix: string
  lastFour: string
  scopes: ApiScope[]
  status: 'ACTIVE' | 'REVOKED'
  environment: Environment
  createdAt: string
  revokedAt: string | null
}

// Matches IssuedApiKeyResponse — rawKey shown once only
export interface ApiKeyCreated extends ApiKey {
  rawKey: string
}

// ── Webhooks ───────────────────────────────────────────────────────────────
// Route: /v1/webhook-subscriptions  (not /v1/webhooks/subscriptions)
// eventTypes: plain Nomba event strings e.g. "INBOUND_PAYMENT", "TRANSFER_SETTLEMENT"
// No deliveryRate, no lastDeliveredAt — not in backend response
export interface WebhookSubscription {
  id: string
  url: string
  eventTypes: string[]
  status: 'ACTIVE' | 'PAUSED'
  environment: Environment
  createdAt: string
}

// Returned on create only — secret shown once, then lost (like rawKey on keys)
export interface WebhookSubscriptionCreated extends WebhookSubscription {
  secret: string
  warning: string
}

export interface WebhookDelivery {
  id: string
  subscriptionId: string
  eventType: string
  status: 'PENDING' | 'SENDING' | 'DELIVERED' | 'DEAD'
  attemptCount: number
  nextRetryAt?: string
  responseCode: number | null
  latencyMs: number | null
  createdAt: string
}

// ── KYC / Account statuses ────────────────────────────────────────────────
export type KycTier = 'TIER_1' | 'TIER_2' | 'TIER_3'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
export type VirtualAccountStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CLOSED' | 'FAILED'

export interface VirtualAccount {
  id?: string
  accountNumber: string
  bankName: string
  accountName: string
  status: VirtualAccountStatus
}

// ── Balance ────────────────────────────────────────────────────────────────
// Matches BalanceResponse { available, spendable, inflightDebit, currency }
// Fetched separately: GET /v1/customers/{id}/balance
// spendable = available - inflightDebit (computed server-side)
export interface BalanceState {
  available: string
  spendable: string
  inflightDebit: string
  currency: string
}

// ── Account events ────────────────────────────────────────────────────────
export type AccountEventType =
  | 'CUSTOMER_CREATED'
  | 'NAME_CHANGED'
  | 'KYC_TIER_CHANGED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REACTIVATED'
  | 'ACCOUNT_CLOSED'
  | 'BVN_ATTACHED'

export interface AccountEvent {
  id: string
  type: AccountEventType
  payload: Record<string, unknown>
  createdAt: string
}

// ── Reconciliation ────────────────────────────────────────────────────────
export type ReconciliationOutcome =
  | 'MATCHED' | 'UNDERPAID' | 'OVERPAID' | 'PARTIAL' | 'SPLIT'
  | 'MISDIRECTED' | 'DUPLICATE' | 'UNRESOLVED' | 'KYC_LIMIT_EXCEEDED'

export type MisdirectedFlagReason =
  | 'ACCOUNT_NOT_FOUND' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_CLOSED'
  | 'SENDER_NAME_MISMATCH' | 'AMOUNT_ANOMALY'

// ── Transactions ───────────────────────────────────────────────────────────
// Matches TransactionResponse { transactionId, reference, type, direction,
//   amount, currency, balanceAfter, status, occurredAt }
// Fetched separately: GET /v1/customers/{id}/transactions (paginated)
export type TransactionDirection = 'CREDIT' | 'DEBIT'

export interface Transaction {
  transactionId: string
  reference: string
  type: string
  direction: TransactionDirection
  amount: string
  currency: string
  balanceAfter: string
  status: string
  occurredAt: string
}

export interface TransactionPage {
  content: Transaction[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

// ── Customer ───────────────────────────────────────────────────────────────
// Matches CustomerResponse { id, appId, externalRef, fullName, email, phone,
//   bvnMasked, kycTier, status, createdAt, virtualAccount }
// nuban/bankName are convenience aliases for virtualAccount.accountNumber/bankName
// balance and transactions are NOT embedded — use separate API calls
export interface Customer {
  id: string
  appId: string
  externalRef: string
  fullName: string
  email: string
  phone?: string
  bvnMasked?: string
  nuban: string
  bankName: string
  virtualAccount: VirtualAccount
  accountStatus: AccountStatus
  kycTier: KycTier
  environment: Environment
  createdAt: string
  events: AccountEvent[]
}

export interface MisdirectedQueueItem {
  transactionId: string
  customerId: string
  customerName: string
  senderName: string
  senderBank: string
  amount: string
  flagReason: MisdirectedFlagReason
  detectedAt: string
}

// ── API Logs ──────────────────────────────────────────────────────────────
export interface ApiLogEntry {
  id: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  path: string
  statusCode: number
  latencyMs: number
  environment: Environment
  timestamp: string
  requestBody?: Record<string, unknown> | null
  responseBody?: Record<string, unknown> | null
}

// ── Overview ──────────────────────────────────────────────────────────────
export interface OverviewStats {
  customers: number
  apps: number
  activeApiKeys: number
  activeWebhookSubscriptions: number
  inboundCount: number
  inboundVolume: string
  payoutCount: number
  payoutVolume: string
}

export interface VolumePoint {
  date: string
  volumeNgn: number
}

export interface RecentActivityItem {
  occurredAt: string
  kind: 'PAYOUT' | 'INBOUND'
  counterparty: string
  narration: string
  amount: number
  status: string
}

// ── Sandbox ───────────────────────────────────────────────────────────────
export type SandboxScenario = 'success' | 'sender_mismatch' | 'duplicate'

export interface SandboxSimulation {
  id: string
  virtualAccountId: string
  customerName: string
  amount: string
  senderName: string
  senderBank: string
  scenario: SandboxScenario
  result: ReconciliationOutcome
  createdAt: string
}

// ── Outbound Transfers ────────────────────────────────────────────────────
// destinationAccountName is @NotBlank — required on create
// fee is optional BigDecimal on create
// nombaTransferId set after SUBMITTED; failureReason set on FAILED
export type TransferStatus = 'PENDING' | 'SUBMITTED' | 'COMPLETED' | 'FAILED'
export type SubAccountType = 'OPS' | 'VAULT'

export interface OutboundTransfer {
  id: string
  appId: string
  customerId?: string | null
  sourceSubAccount: SubAccountType
  amount: string
  fee?: string | null
  destinationAccountNumber: string
  destinationBankCode: string
  destinationAccountName: string
  narration: string
  merchantTxRef: string
  nombaTransferId?: string | null
  status: TransferStatus
  environment: Environment
  createdAt: string
  submittedAt?: string | null
  completedAt?: string | null
  failureReason?: string | null
}

// ── Settings ──────────────────────────────────────────────────────────────
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// DeveloperResponse { id, name, email, company, liveEnabled, status, createdAt }
// name maps to businessName for display
export interface DeveloperProfile {
  businessName: string
  email: string
  phone: string
  company?: string
  kycStatus: KycStatus
  liveEnabled: boolean
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  developer: {
    id: string
    businessName: string
    email: string
  }
}
