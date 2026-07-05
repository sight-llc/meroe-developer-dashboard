import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Spinner } from '@/components/shared/PageHeader'

export function ProtectedRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-paper">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
