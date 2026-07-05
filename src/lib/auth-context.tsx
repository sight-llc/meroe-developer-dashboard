import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loginDeveloper, logoutDeveloper, refreshSession, registerDeveloper, ApiError } from './api'
import { tokenStore } from './token-store'
import type { AuthSession } from '@/types'

// ── Storage keys ──────────────────────────────────────────────────────────────
// ← mock-only: replace REFRESH_KEY with the real token from login response body
// When real API is wired, sessionStorage is still fine for the refresh token.
// If you want a longer-lived session, switch to localStorage — just add a "keep me logged in" checkbox.
const REFRESH_KEY = 'meroe_refresh_token'
const SESSION_KEY = 'meroe_session_meta' // stores { developer } for UI display

// ─────────────────────────────────────────────────────────────────────────────

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  session: AuthSession | null
  login: (email: string, password: string) => Promise<void>
  register: (input: { name: string; email: string; company: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    const storedRefresh = sessionStorage.getItem(REFRESH_KEY)
    if (!storedRefresh) {
      setStatus('unauthenticated')
      return
    }
    // Attempt silent refresh on mount — this is where the real API call lands when wired up
    refreshSession(storedRefresh)
      .then((s) => {
        tokenStore.set(s.accessToken)
        sessionStorage.setItem(REFRESH_KEY, s.refreshToken)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s.developer))
        setSession(s)
        setStatus('authenticated')
      })
      .catch((error) => {
        // Only logout on auth errors (401/403) - server errors (5xx) should not log out user
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          sessionStorage.removeItem(REFRESH_KEY)
          sessionStorage.removeItem(SESSION_KEY)
          tokenStore.clear()
          setStatus('unauthenticated')
        } else {
          // For other errors (including 5xx), keep user in loading state
          // The retry logic in refreshSession will handle 5xx errors
          setStatus('unauthenticated')
        }
      })
  }, [])

  async function login(email: string, password: string) {
    const s = await loginDeveloper({ email, password })
    tokenStore.set(s.accessToken)
    sessionStorage.setItem(REFRESH_KEY, s.refreshToken)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s.developer))
    setSession(s)
    setStatus('authenticated')
  }

  async function register(input: { name: string; email: string; company: string; password: string }) {
    await registerDeveloper(input)
    // Auto-login after registration
    await login(input.email, input.password)
  }

  async function logout() {
    await logoutDeveloper()
    sessionStorage.removeItem(REFRESH_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    tokenStore.clear()
    setSession(null)
    setStatus('unauthenticated')
  }

  return (
    <AuthContext.Provider value={{ status, session, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
