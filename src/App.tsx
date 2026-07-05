import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth-context'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { queryClient } from '@/lib/query-client'

// Auth pages
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'

// Dashboard pages
import Overview from '@/pages/Overview'
import Apps from '@/pages/Apps'
import ApiKeys from '@/pages/ApiKeys'
import Webhooks from '@/pages/Webhooks'
import Customers from '@/pages/Customers'
import CustomerDetail from '@/pages/CustomerDetail'
import Reconciliation from '@/pages/Reconciliation'
import Transfers from '@/pages/Transfers'
import ApiLogs from '@/pages/ApiLogs'
import Sandbox from '@/pages/Sandbox'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Sonner toast portal — positioned top-right, themed to match Meroe */}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                'font-sans text-sm rounded-sm border border-paper-200 shadow-lg',
              title: 'font-medium text-ink',
              description: 'text-ink-600/70',
              success: '!border-vault-300/60 !bg-vault-50',
              error: '!border-red-200 !bg-red-50',
              warning: '!border-gold-400/40 !bg-gold-400/10',
              info: '!border-paper-200 !bg-white',
            },
          }}
          richColors
          closeButton
        />

        <Routes>
          {/* ── Public auth routes ─────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Protected dashboard routes ─────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/keys" element={<ApiKeys />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/logs" element={<ApiLogs />} />
              <Route path="/sandbox" element={<Sandbox />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* ── Catch-all ──────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}