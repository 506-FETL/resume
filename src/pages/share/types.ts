import type { ResumeType } from '@/lib/schema'
import type { ResumeShareSnapshotSource } from '@/lib/supabase/resume/share.types'

export interface ResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>
