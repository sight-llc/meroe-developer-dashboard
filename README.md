# Meroe Developer Dashboard

A Tremor + shadcn/ui-style developer dashboard for Meroe: apps, API keys,
webhooks, customers & balances, the reconciliation board, outbound
transfers, API logs, sandbox, and account settings. Built with Vite + React
+ TypeScript + Tailwind + [`@tremor/react`](https://tremor.so) +
Radix UI primitives.

Runs entirely on **mock data** — no backend required — so the UI and your
team's Spring Boot work can move in parallel.

## Getting started

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`. You'll land on `/login` first — any email
and a password ≥ 4 characters gets you in (see the demo hint on the login
page).

## Project structure

```
src/
  types/index.ts        # Domain types mirroring the architecture's DB schema
  mocks/data.json         # All mock data, one file, one source of truth
  lib/
    api.ts                 # ⭐ the swap-in layer — see below
    auth-context.tsx        # AuthProvider + useAuth() hook
    utils.ts                  # formatting helpers (NGN currency, dates, %)
    constants.ts               # sidebar nav config
  components/
    auth/                # AuthLayout, ProtectedRoute
    layout/                # Sidebar, Topbar, DashboardLayout shell
    shared/                  # StatusBadge, EmptyState, ConfirmModal, CopyButton, etc.
    ui/                        # shadcn/ui-style primitives (Button, Input, Select, Label)
  pages/
    auth/
      Login.tsx
      Register.tsx
      ForgotPassword.tsx
    Overview.tsx           # F2a
    Apps.tsx                 # Apps layer — namespace for keys/customers/webhooks
    ApiKeys.tsx                # F2b — keys scoped to an App
    Webhooks.tsx                 # F2c
    Customers.tsx                  # F2d (list, filterable by App)
    CustomerDetail.tsx               # F2d (detail — balances, transactions, events)
    Reconciliation.tsx                 # F2e
    Transfers.tsx                        # Outbound transfers (OPS/VAULT sub-accounts)
    ApiLogs.tsx                            # F2f
    Sandbox.tsx                              # F2g — CLI webhook simulator
    Settings.tsx                               # F2h
```

## Auth

`AuthProvider` wraps the whole app and exposes `useAuth()` with
`{ status, session, login, logout }`. `ProtectedRoute` redirects
unauthenticated visitors to `/login`, preserving the page they were headed
to so login sends them back.

The mock session persists across page refresh via a `sessionStorage` flag
(`meroe_mock_has_session`) — every spot using this is commented
`// ← mock-only` in `auth-context.tsx` and should be deleted once the real
`POST /v1/auth/refresh` endpoint sets an httpOnly cookie, which the browser
will then send automatically.

## How to swap mock data for the real API

Everything lives in **`src/lib/api.ts`**. Every page calls a function from
this file — never `fetch` directly — so this is the only file that needs to
change.

Each function already has its real call commented out directly above the
mock line, e.g.:

```ts
export async function getCustomers(params?: { appId?: string; search?: string; status?: string }): Promise<Customer[]> {
  // return request(`/v1/customers?${new URLSearchParams(params).toString()}`)
  return mockResolve(...)   // ← delete this line once the line above is uncommented
}
```

Steps:

1. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.
2. In `src/lib/api.ts`, for each function: delete the `mockResolve(...)`
   line, uncomment the `request(...)` line above it.
3. Once every function is swapped, delete `src/mocks/data.json` and the
   `import mock from '@/mocks/data.json'` line at the top of `api.ts`.
4. The `request()` helper sends `credentials: 'include'` for cookie-based
   session auth — adjust if you're using bearer tokens instead.

No page or component needs to change — they only ever import from
`@/lib/api`, and every function's signature/return type matches the real
endpoint contract from the architecture docs.

## Notes on architecture alignment

- **Apps layer**: customers, API keys, and webhook subscriptions are scoped
  to an App (`Developer → Apps → Customers`), not directly to the developer.
- **Balance fields**: the stored field is `available_balance` (not
  `balance`). Two derived values are computed client-side for display:
  `expected_balance = credit_balance − debit_balance` and
  `withdrawable_balance = available_balance − inflight_debit_balance`.
- **Sandbox**: there's no `/v1/sandbox/simulate/payment` REST endpoint in
  the architecture — simulated payments are sent via a Python CLI
  (`webhook_simulator.py`) posting to `/v1/webhooks/nomba` directly. The
  Sandbox page reflects this: it builds and lets you copy the CLI command
  rather than submitting a form to a nonexistent endpoint.
- **Transfers**: the developer dashboard can initiate transfers and see
  their status, but approval for above-threshold transfers (maker-checker)
  happens on the separate Admin dashboard — not here.

## Design tokens

Defined in `tailwind.config.ts`:

- `ink` (#0F1A14) — sidebar / primary text
- `paper` (#FAF9F6) — canvas background
- `vault` (#0B6E4F) — brand / "matched" / primary actions
- `gold` (#B9852E) — "unmatched" / live-environment / key-reveal accent
- `misdirected` (#B3261E) — destructive / flagged state

Typography: IBM Plex Sans (UI) + IBM Plex Mono (NUBANs, amounts, keys, JSON —
anywhere exactness matters).

