import { FEATURES, type FeatureKey } from '@/lib/features'
import { ComingSoon } from '@/components/shared/ComingSoon'
import type { LucideIcon } from 'lucide-react'

interface FeaturePageProps {
  /** Which feature flag gates this page */
  feature: FeatureKey
  /** Passed to ComingSoon when the feature is off */
  comingSoon: {
    title: string
    description: string
    features: string[]
    icon: LucideIcon
    eta?: string
  }
  /** The real/mock page content */
  children: React.ReactNode
}

/**
 * Renders `children` when the feature flag is on, otherwise shows the ComingSoon UI.
 *
 * Usage:
 *   <FeaturePage feature="MOCK_UI" comingSoon={{ title: ..., ... }}>
 *     <RealPageContent />
 *   </FeaturePage>
 */
export function FeaturePage({ feature, comingSoon, children }: FeaturePageProps) {
  if (!FEATURES[feature]) {
    return <ComingSoon {...comingSoon} />
  }
  return <>{children}</>
}
