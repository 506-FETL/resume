import type { ResumeListItem } from '@/lib/schema'

export type Resume = Required<Pick<ResumeListItem, 'updated_at'>> &
  ResumeListItem

export interface ResumeStats {
  total: number
  online: number
  offline: number
  recentCount: number
  latestResume: Resume | undefined
}
