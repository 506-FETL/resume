import type { ResumeListItem } from '@/lib/schema'
import type { AuthStatus } from '@/store/user'

export type Resume = Required<Pick<ResumeListItem, 'updated_at'>> &
  ResumeListItem

export type DashboardMode = 'pending' | 'guest' | 'onboarding' | 'workspace'

export interface DashboardModeInput {
  authStatus: AuthStatus
  accountMatches: boolean
  resumeCount: number
  resumesConfirmedEmpty: boolean
  jobsCount: number
  jobsConfirmedEmpty: boolean
}
