import type { ResumeType } from '@/lib/schema'
import type { ResumeShareSnapshotSource, ShareVersionSelection } from '@/lib/supabase/resume/share.types'

export interface ResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

export type SnapshotProvider = () => Promise<ResumeShareSnapshotSource>

export type VersionDialogSelection
  = | ShareVersionSelection
    | {
      kind: 'deleted-history'
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }
