// Simple module-level token store.
// auth-context.tsx calls tokenStore.set() on login/refresh and tokenStore.clear() on logout.
// api.ts reads from tokenStore.get() to attach Authorization headers.
//
// This is intentionally simple — no persistence. The token lives in memory for the tab's lifetime.
// The refresh token (stored in sessionStorage by auth-context) is used to re-hydrate on page load.

let _accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => _accessToken,
  set: (token: string | null): void => { _accessToken = token },
  clear: (): void => { _accessToken = null },
}
