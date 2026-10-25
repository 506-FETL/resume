import type { ResumeListItem } from '@/lib/schema'
import type { AuthStatus } from '@/store/user'

export type Resume = Required<Pick<ResumeListItem, 'updated_at'>> &
  ResumeListItem

export interface ResumeStats {
  total: number
  online: number
  offline: number
  recentCount: number
  latestResume: Resume | undefined
}

export type DashboardMode = 'pending' | 'guest' | 'onboarding' | 'workspace'

export interface DashboardModeInput {
  authStatus: AuthStatus
  accountMatches: boolean
  resumeCount: number
  resumesConfirmedEmpty: boolean
  jobsCount: number
  jobsConfirmedEmpty: boolean
}
