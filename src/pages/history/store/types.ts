import type { HistoryCurrentResume, RestoreStrategy, VersionMetadataDraft } from '../types'
import type { ResumeHistoryVersionListItem, ResumeHistoryVersionRecord, ResumeSnapshot } from '@/lib/supabase/resume/history'

export interface HistoryStoreState {
  // Data slice
  resumeId: string | null
  currentResume: HistoryCurrentResume | null
  versions: ResumeHistoryVersionListItem[]
  snapshotCache: Record<number, ResumeSnapshot>
  error: string | null

  init: (resumeId: string | null | undefined) => Promise<void>
  reload: () => Promise<void>
  loadVersionSnapshot: (id: number) => Promise<ResumeSnapshot | null>
  saveCurrentVersion: (draft: VersionMetadataDraft) => Promise<ResumeHistoryVersionRecord | null>
  updateVersionMetadata: (versionId: number, draft: VersionMetadataDraft) => Promise<ResumeHistoryVersionRecord | null>
  restoreVersion: (versionId: number, strategy: RestoreStrategy) => Promise<ResumeHistoryVersionRecord | null>
  deleteVersion: (versionId: number) => Promise<boolean>

  // UI slice
  loading: boolean
  savingCurrent: boolean
  savingMetadata: boolean
  restoring: boolean
  deletingVersionId: number | null
}
