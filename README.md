# Meroe Developer Dashboard

A Tremor + shadcn/ui-style developer dashboard for **Meroe** (formerly nombadva) — the embedded finance platform for building financial products. Built with Vite + React + TypeScript + Tailwind + [`@tremor/react`](https://tremor.so) + Radix UI primitives.

The dashboard provides developers with a comprehensive interface to manage apps, API keys, webhooks, customers, balances, reconciliation, outbound transfers, API logs, sandbox testing, and account settings.

## Live deployment

The dashboard is deployed at: [https://meroe-developer-dashboard.vercel.app/](https://meroe-developer-dashboard.vercel.app/)

## About Meroe

Meroe (formerly nombadva) is an embedded finance platform that enables developers to build financial products. For more context on Meroe's architecture and API design, see the main repository: [https://github.com/sight-llc/nombadva](https://github.com/sight-llc/nombadva)

## Getting started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- A Meroe API key (for sandbox or production access)

### Installation

```bash
npm install
```

### Environment setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` to set your API base URL:

```env
# Base URL for the Meroe API
VITE_API_BASE_URL=https://api.meroe.dev

# Mock UI flag — controls coming-soon pages.
# VITE_MOCK_UI=enabled  →  coming-soon pages render their full mock UI
# (unset / anything else)  →  coming-soon pages show the "Coming soon" component
#
# Pages affected: Overview, Webhooks, Reconciliation, Transfers, API Logs, Settings
# Always-live pages (no flag needed): Apps, API Keys, Customers, Customer Detail, Sandbox
```

### Development

```bash
npm run dev
```

Opens on `http://localhost:5173`. You'll land on `/login` first.

### Build

```bash
npm run build
```

## Project structure

```
src/
  types/index.ts        # Domain types mirroring the Meroe API schema
  lib/
    api.ts                 # ⭐ API layer — all backend calls go through here
    auth-context.tsx        # AuthProvider + useAuth() hook
    token-store.ts           # JWT token management
    active-key-store.ts      # Active API key management
    features.ts              # Feature flags (VITE_MOCK_UI)
    query-client.ts          # TanStack Query client configuration
    utils.ts                 # formatting helpers (NGN currency, dates, %)
    constants.ts             # sidebar nav config
  components/
    auth/                # AuthLayout, ProtectedRoute
    layout/                # Sidebar, Topbar, DashboardLayout shell
    shared/                # StatusBadge, EmptyState, ConfirmModal, CopyButton, etc.
    ui/                  # shadcn/ui-style primitives (Button, Input, Select, Label)
  pages/
    auth/
      Login.tsx
      Register.tsx
      ForgotPassword.tsx
    Overview.tsx           # Dashboard overview with stats
    Apps.tsx               # Apps management
    ApiKeys.tsx            # API key management (scoped to apps)
    Webhooks.tsx           # Webhook subscription management
    Customers.tsx          # Customer list (filterable by app)
    CustomerDetail.tsx     # Customer detail view (balances, transactions, events)
    Reconciliation.tsx     # Reconciliation board
    Transfers.tsx          # Outbound transfers
    ApiLogs.tsx            # API request logs
    Sandbox.tsx            # CLI webhook simulator
    Settings.tsx           # Account settings
```

## API Integration

The dashboard is fully integrated with the Meroe API. All API calls are centralized in `src/lib/api.ts` — pages and components never call `fetch` directly.

### Authentication

The dashboard uses a dual authentication system:

- **Developer JWT**: Used for authentication, app management, and developer profile operations
- **API Key**: Used for customer and payment operations (scoped to specific apps)

```ts
// JWT authentication (developer login/register)
POST /v1/developers/auth/login
POST /v1/developers/auth/register
POST /v1/developers/auth/refresh

// API key authentication (customer operations)
// API keys are set as Bearer tokens in the Authorization header
```

### API Endpoints

All endpoints are implemented and integrated:

| Category | Endpoints | Status |
|----------|-----------|--------|
| Auth | register, login, refresh | ✅ Live |
| Apps | GET, POST, PATCH, DELETE | ✅ Live |
| API Keys | GET, POST, DELETE, roll | ✅ Live |
| Customers | GET, POST, PATCH, PUT (kyc/suspend/reactivate/close) | ✅ Live |
| Webhooks | GET, POST, DELETE, test, deliveries | ✅ Live |
| Transfers | GET, POST, approve, reject, reconcile, internal | ✅ Live |
| Reconciliation | summary, misdirected-payments | ✅ Live |
| API Logs | GET (filtered) | ✅ Live |
| Sandbox | history | ✅ Live |
| Settings | profile, transaction-pin, password | ✅ Live |

### Remaining Mocked Functions

Two functions remain mocked as the backend endpoints are not yet available:

- `initiateRefund(txId)` - POST /v1/transfers/{id}/refund
- `uploadKycDocuments()` - POST /v1/developers/me/kyc-documents

These are clearly marked in the code and will be swapped when the backend endpoints are ready.

## Architecture notes

- **Apps layer**: customers, API keys, and webhook subscriptions are scoped to an App (`Developer → Apps → Customers`), not directly to the developer.
- **Balance fields**: the stored field is `available_balance` (not `balance`). Two derived values are computed client-side for display: `expected_balance = credit_balance − debit_balance` and `withdrawable_balance = available_balance − inflight_debit_balance`.
- **Sandbox**: simulated payments are sent via a Python CLI (`webhook_simulator.py`) posting to `/v1/webhooks/nomba` directly. The Sandbox page builds and lets you copy the CLI command.
- **Transfers**: the developer dashboard can initiate transfers and see their status, but approval for above-threshold transfers (maker-checker) happens on the separate Admin dashboard.

## Design tokens

Defined in `tailwind.config.ts`:

- `ink` (#0F1A14) — sidebar / primary text
- `paper` (#FAF9F6) — canvas background
- `vault` (#0B6E4F) — brand / "matched" / primary actions
- `gold` (#B9852E) — "unmatched" / live-environment / key-reveal accent
- `misdirected` (#B3261E) — destructive / flagged state

Typography: IBM Plex Sans (UI) + IBM Plex Mono (NUBANs, amounts, keys, JSON — anywhere exactness matters).

## License

MIT