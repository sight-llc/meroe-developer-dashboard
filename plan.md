Plan
1. Install TanStack Query
@tanstack/react-query
@tanstack/react-query-devtools (optional, for dev)
2. Active Key Store (src/lib/active-key-store.ts)

Holds the selected API key in memory + sessionStorage
activeKeyStore.get() → returns the raw key string
activeKeyStore.set(key: string, displayLabel: string) → sets the key
activeKeyStore.getLabel() → returns display label like nv_test_sk_••••a1b2
activeKeyStore.clear() → clears

3. Update request() in api.ts

Add a useApiKey parameter (or detect from path)
Routes that need API key: /v1/customers, /v1/transfers (initiate)
Routes that use JWT: everything else
Better approach: add a second request variant or pass auth type

Actually, the cleanest approach: add an optional authType: 'jwt' | 'apikey' parameter to request(). Internally:

'jwt' → uses tokenStore.get()
'apikey' → uses activeKeyStore.get()

4. Real API integration — uncomment all request() calls
For the 20 endpoints, replace mockResolve(...) with request(...).
5. TanStack Query setup

QueryClient with default config (staleTime, retry, etc.)
QueryClientProvider in App.tsx
ReactQueryDevtools in dev mode

6. Replace useApi with useQuery/useMutation in all pages
Query keys convention:
['apps']
['api-keys', appFilter]
['customers', { search, status, appId }]
['customer', id]
['customer-balance', id]
['customer-transactions', id]
['webhook-subscriptions']
['webhook-deliveries', subscriptionId]
['transfers', status]
['overview-stats']
['volume-series', days]
['recent-activity']
['api-logs', { statusCode, environment, path }]
['sandbox-history']
['developer-profile']
Mutations:

createApp → invalidate ['apps']
updateApp → invalidate ['apps']
deactivateApp → invalidate ['apps']
createApiKey → invalidate ['api-keys']
revokeApiKey → invalidate ['api-keys']
rollApiKey → invalidate ['api-keys']
createWebhookSubscription → invalidate ['webhook-subscriptions']
deleteWebhookSubscription → invalidate ['webhook-subscriptions']
suspendCustomer → invalidate ['customer', id]
reactivateCustomer → invalidate ['customer', id]
closeCustomer → invalidate ['customer', id]
renameCustomer → invalidate ['customer', id], ['customers']
changeKycTier → invalidate ['customer', id]
approveTransfer → invalidate ['transfers']
rejectTransfer → invalidate ['transfers']
initiateTransfer → invalidate ['transfers']
confirmCorrect → invalidate ['reconciliation']
initiateRefund → invalidate ['reconciliation']

7. Topbar key selector

Shows current active key (keyPrefix••••lastFour) in a dropdown
Dropdown lists all ACTIVE keys
On API key creation → auto-set rawKey as active key
If no key → shows "No API key selected" in red/warning

8. Banner on customer-related pages when no key selected
9. Delete useApi.ts hook (replaced by TanStack Query)
Implementation Order:

Install deps
active-key-store.ts
Update api.ts:
a. Add authType to request()
b. Uncomment all 20 request() calls
c. Keep mock data for ❌ endpoints (overview, logs, settings, reconciliation, sandbox, some others)
Setup TanStack Query in App.tsx
Update Topbar.tsx with key selector
Update all pages — replace useApi with useQuery/useMutation
Add "no API key" banner component
TypeScript check + build

Let me now figure out which endpoints get real request() vs stay mock:
Real request() calls (✅ confirmed in backend):

loginDeveloper → POST /v1/developers/auth/login
refreshSession → POST /v1/developers/auth/refresh
registerDeveloper → POST /v1/developers/auth/register
getApps → GET /v1/apps
createApp → POST /v1/apps
getApiKeys → GET /v1/api-keys
createApiKey → POST /v1/api-keys
revokeApiKey → DELETE /v1/api-keys/{id}
getCustomers → GET /v1/customers (API key)
getCustomer → GET /v1/customers/{id} (API key)
getCustomerBalance → GET /v1/customers/{id}/balance (API key)
getCustomerTransactions → GET /v1/customers/{id}/transactions (API key)
renameCustomer → PATCH /v1/customers/{id}/name (API key)
changeKycTier → PUT /v1/customers/{id}/kyc (API key)
suspendCustomer → PUT /v1/customers/{id}/suspend (API key)
reactivateCustomer → PUT /v1/customers/{id}/reactivate (API key)
closeCustomer → PUT /v1/customers/{id}/close (API key)
getWebhookSubscriptions → GET /v1/webhook-subscriptions (JWT)
createWebhookSubscription → POST /v1/webhook-subscriptions (JWT)
deleteWebhookSubscription → DELETE /v1/webhook-subscriptions/{id} (JWT)

Stay mock (❌ no backend):

getOverviewStats, getVolumeSeries, getRecentActivity
getApiLogs
getDeveloperProfile, updateDeveloperProfile, uploadKycDocuments, changePassword
getSandboxHistory
getReconciliationSummary, getMisdirectedQueue, confirmCorrect, initiateRefund
getOutboundTransfers, initiateTransfer, approveTransfer, rejectTransfer
updateApp, deactivateApp (no backend endpoints)
rollApiKey (no backend endpoint)
testWebhookSubscription, getWebhookDeliveries
downloadStatement
logoutDeveloper (no backend endpoint)

Now let me think about the authType approach. I'll add it as a parameter to request():
tsasync function request<T>(path: string, init?: RequestInit & { authType?: 'jwt' | 'apikey' }): Promise<T>
API key endpoints will pass authType: 'apikey'.
For the Topbar key selector, I need to:

Show current active key info
Allow switching between keys
Show a warning if no key selected

The Topbar currently gets profile from getDeveloperProfile. With TanStack Query, I'll use useQuery.
Let me now think about how ApiStateDisplay maps to TanStack Query. With useQuery:

isLoading (first load, no data)
isFetching (background refetch)
error (Error object)
refetch (retry function)

The ApiStateDisplay component takes { loading, error, retry } — I can keep it as-is, just pass isLoading, error?.message, refetch.
For mutations, the pattern will be:
tsconst mutation = useMutation({
  mutationFn: createApp,
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['apps'] })
    toast.success(...)
  },
  onError: (e) => { toast.error(...) }
})
Let me now plan the file changes:
Files to create:

src/lib/active-key-store.ts — new
src/lib/query-client.ts — new (QueryClient config)

Files to update:

package.json — add @tanstack/react-query
src/App.tsx — QueryClientProvider + ReactQueryDevtools
src/lib/api.ts — real requests + authType param
src/components/layout/Topbar.tsx — key selector
src/components/shared/NoApiKey.tsx — new banner component
src/pages/Apps.tsx — useQuery/useMutation
src/pages/ApiKeys.tsx — useQuery/useMutation, auto-set active key on create
src/pages/Customers.tsx — useQuery, no-api-key banner
src/pages/CustomerDetail.tsx — useQuery/useMutation
src/pages/Webhooks.tsx — useQuery/useMutation
src/pages/Transfers.tsx — useQuery/useMutation
src/pages/Overview.tsx — useQuery
src/pages/ApiLogs.tsx — useQuery
src/pages/Settings.tsx — useQuery/useMutation
src/pages/Reconciliation.tsx — useQuery/useMutation
src/pages/Sandbox.tsx — useQuery

Files to delete:

src/hooks/useApi.ts — replaced by TanStack Query

Let me now write all the code. I'll be systematic and efficient.
For the QueryClient config:
tsexport const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — data considered fresh
      gcTime: 5 * 60_000,       // 5min — keep in cache
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    }
  }
})
For the active key store, I need to store:

The raw key string (for Authorization header)
Display info (keyPrefix + lastFour + appName) for the topbar

tsinterface ActiveKey {
  rawKey: string          // full key for Authorization header
  keyPrefix: string       // for display
  lastFour: string        // for display
  appName?: string        // for display
  environment: Environment // for display
}
For the request() function, I need to handle the case where:

JWT routes: use tokenStore.get()
API key routes: use activeKeyStore.get()?.rawKey

The cleanest way: add authType?: 'jwt' | 'apikey' to the init param.
Now, for the actual API responses — I need to make sure the response shapes match what we expect. The backend returns Java record/DTO shapes. Let me think about potential mismatches:

AppResponse — should match our App type mostly
ApiKeyResponse — keyPrefix, lastFour, status (ACTIVE/REVOKED), etc. — should match
IssuedApiKeyResponse — has rawKey, keyPrefix, lastFour — matches our ApiKeyCreated with rawKey
CustomerResponse — has id, appId, externalRef, fullName, email, phone, bvnMasked, kycTier, status, createdAt, virtualAccount — we need to map status → accountStatus, virtualAccount.accountNumber → nuban, virtualAccount.bankName → bankName
BalanceResponse — available, spendable, inflightDebit, currency — matches exactly
TransactionResponse — transactionId, reference, type, direction, amount, currency, balanceAfter, status, occurredAt — matches exactly
WebhookSubscriptionResponse — id, url, eventTypes, status, environment, createdAt — matches exactly
WebhookSubscriptionCreatedResponse — adds secret, warning — matches

For CustomerResponse mapping, I'll add a mapCustomer() helper in api.ts that maps the raw API response to our Customer type.
For TokenResponse: accessToken, refreshToken, tokenType, expiresIn — our AuthSession type has all of these except tokenType. I'll add tokenType?: string or just ignore it.
Actually wait — looking at the DeveloperResponse in the backend auth responses... the login might return a different shape. Let me think: POST /v1/developers/auth/login returns TokenResponse. Does it also return developer info embedded? Looking at the existing mock, we assumed it returned { accessToken, refreshToken, expiresIn, developer: { id, businessName, email } }. But the real backend TokenResponse might just be { accessToken, refreshToken, tokenType, expiresIn } without the developer object.
Looking at the code I analyzed earlier — TokenResponse is a Java record. It likely has: accessToken, refreshToken, tokenType, expiresIn. The developer object in the session might need to be fetched separately or extracted from the JWT.
For the mock, we had the developer info embedded. For the real API, after login we might just get the token and need to decode the JWT to get developer info, or we might need to call GET /v1/developers/me or similar.
Actually, I'll handle this pragmatically: after login, if the API doesn't return developer info, I'll extract it from the JWT payload (base64 decode the middle part). This is safe since JWTs aren't encrypted.
Let me now write everything. I'll be efficient and not repeat myself. Let me plan the pages that need the most changes:
Pages using useQuery (reads):

Overview — 3 queries (stats, volume, activity) — all mock
Apps — 1 query
ApiKeys — 2 queries (apps, keys)
Customers — 2 queries (apps, customers)
CustomerDetail — 3 queries (customer, balance, transactions)
Webhooks — 1 query
Reconciliation — 2 queries (summary, queue)
Transfers — 2 queries (apps, transfers)
ApiLogs — 1 query
Sandbox — 2 queries (customers, history)
Settings — 1 query

Pages using useMutation (writes):

Apps — create, update, deactivate
ApiKeys — create, revoke, roll
Webhooks — create, delete
CustomerDetail — rename, kyc, suspend, reactivate, close, download
Transfers — initiate, approve, reject
Reconciliation — confirm, refund
Settings — update profile, upload kyc, change password

OK, let me now write the code efficiently. I'll write each file fully.
For PageLoading — I was using it from PageHeader.tsx. With TanStack Query, I'll use ApiStateDisplay directly. Actually, ApiStateDisplay already handles the loading/error states.
One key thing — useQuery returns isLoading (true only on first load with no cached data) and isFetching (true on any fetch including background refetches). I should use isLoading for the full page spinner and not show a loading spinner on background refetches.
Also, useQuery's error is Error | null. I'll pass error?.message ?? null to ApiStateDisplay.
Let me also think about enabled option for queries that depend on other data:

getCustomerBalance(id) — enabled only if id is defined
getCustomerTransactions(id) — same
getApiKeys(appFilter) — always enabled

And for the Topbar key selector — it needs access to the list of API keys. I can either:

Use useQuery(['api-keys']) in the Topbar directly (cached, so no extra network request)
Pass key info via context

I'll use option 1 — since the query is cached, fetching it in the Topbar just reads from cache after the ApiKeys page has loaded it.
Actually, the Topbar renders on every page. If the user hasn't visited the ApiKeys page yet, the cache is empty. So the Topbar should run useQuery(['api-keys']) itself, which will fetch on first mount. That's fine — it's a small, fast request.
But wait — the Topbar is rendered even when we're on pages that don't load API keys (like Overview). So the first render of the dashboard will trigger GET /v1/api-keys from the Topbar. That's actually good — we want to know the active key status right away.
Let me now actually write the code. I'll be systematic.
One more thing — for the activeKeyStore, when a user creates a new API key, the rawKey should be auto-set as the active key. This happens in ApiKeys.tsx on create mutation success.
Also, on app load, I should try to restore the active key from sessionStorage if available.
OK I think I have enough plan. Let me write the code now.
Total files to write:

active-key-store.ts — new
query-client.ts — new
NoApiKey.tsx — new banner component
api.ts — real requests, authType
App.tsx — QueryClientProvider
Topbar.tsx — key selector
Apps.tsx — useQuery/useMutation
ApiKeys.tsx — useQuery/useMutation, auto-set active key
Customers.tsx — useQuery, no-key banner
CustomerDetail.tsx — useQuery/useMutation
Webhooks.tsx — useQuery/useMutation
Transfers.tsx — useQuery/useMutation
Overview.tsx — useQuery
ApiLogs.tsx — useQuery
Settings.tsx — useQuery/useMutation
Reconciliation.tsx — useQuery/useMutation
Sandbox.tsx — useQuery
Delete useApi.ts

Let me start writing. I'll be concise in the code, not repeat patterns.
Actually, let me reconsider the scope. The user said "don't build yet" earlier and then said "YES please" after my explanation. So they want me to build now. Let me be efficient.
For pages that are "coming soon" with FeaturePage wrappers, the inner content still uses TanStack Query — I should update those too since the data fetching code inside them needs updating.
Let me write the code now. Starting with the infrastructure, then pages.
For the request() function signature — I'll add a separate requestWithKey() for API key auth, or just add a flag. I'll go with a clean approach:
tsasync function request<T>(path: string, init?: RequestInit, auth: 'jwt' | 'apikey' = 'jwt'): Promise<T>
This way, JWT is the default (backwards compatible) and API key routes explicitly pass 'apikey'.
Now let me think about what happens if:

auth === 'jwt' but no JWT → throw, redirect to login
auth === 'apikey' but no active key → throw a specific error that the UI can catch

I'll create a specific NoApiKeyError class so the UI can detect it and show the banner.
Actually, keeping it simple: just throw a regular error with message "No API key selected — please create or select an API key first." The NoApiKey banner component will detect this from the error message, or I can use the activeKeyStore.get() check in the component itself.
Actually simplest: check activeKeyStore.get() directly in the component and show the banner if null, before even calling the query. Use enabled: !!activeKeyStore.get() for API key queries.
Let me go with this approach:

useQuery({ enabled: !!activeKeyStore.get(), ... }) for customer queries
If no active key → show NoApiKey component immediately
The NoApiKey component provides a link to the API Keys page

This is cleaner than error detection.