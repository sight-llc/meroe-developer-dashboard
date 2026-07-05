// ─────────────────────────────────────────────────────────────────────────
// TanStack Query client configuration
// ─────────────────────────────────────────────────────────────────────────

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — data considered fresh
      gcTime: 5 * 60_000,          // 5min — keep in cache
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
})