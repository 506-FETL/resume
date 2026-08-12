import type { ResumeType } from '@/lib/schema'
import type { ResumeShareSnapshotSource } from '@/lib/supabase/resume/share.types'

export interface ResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

/** @deprecated 组件命名迁移完成后删除。 */
export type ShareResumeSummary = ResumeSummary

export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>
