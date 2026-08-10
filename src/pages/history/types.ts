import type { ResumeType } from '@/lib/schema'
import type { ResumeHistoryVersionRecord, ResumeSnapshot } from '@/lib/supabase/resume/history'

export type { RestoreStrategy } from '@/lib/supabase/resume/history'

export type HistorySelection = number | 'current' | null

export interface HistoryCurrentResume {
  resumeId: string
  displayName: string
  description: string
  updatedAt: string | null
  type: ResumeType
  snapshot: ResumeSnapshot
}

export interface HistoryResumeOption {
  resumeId: string
  displayName: string
  description: string
  updatedAt: string | null
  type: ResumeType
}

export interface VersionMetadataDraft {
  versionName: string
  milestoneName: string
  description: string
  tags: string[]
}

export type PendingDiscardAction
  = | { type: 'select', target: HistorySelection }
    | { type: 'close' }
    | null

export interface HistoryVersionGroup {
  label: string
  items: ResumeHistoryVersionRecord[]
}
