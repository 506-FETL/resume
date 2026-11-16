import type {
  ResumeHistoryVersionListItem,
  ResumeHistoryVersionRecord,
  ResumeSnapshot,
} from '@/lib/supabase/resume/history'
import type { StoreApi } from 'zustand'
import type {
  HistoryCurrentResume,
  RestoreStrategy,
  VersionMetadataDraft,
} from '../../types'
import type { HistoryStoreState } from '../types'

export interface HistoryDataSlice {
  resetAccount: (accountId: string | null) => void
  resumeId: string | null
  currentResume: HistoryCurrentResume | null
  versions: ResumeHistoryVersionListItem[]
  snapshotGeneration: number
  snapshotCache: Record<number, ResumeSnapshot>
  snapshotErrors: Record<number, string>
  error: string | null
  currentResumeLoading: boolean
  currentResumeError: string | null
  versionsLoading: boolean
  versionsError: string | null
  versionsLoaded: boolean

  init: (resumeId: string | null | undefined) => Promise<void>
  reload: () => Promise<void>
  reloadCurrentResume: () => Promise<void>
  reloadVersions: () => Promise<void>
  loadVersionSnapshot: (id: number) => Promise<ResumeSnapshot | null>
  saveCurrentVersion: (
    draft: VersionMetadataDraft,
  ) => Promise<ResumeHistoryVersionRecord | null>
  updateVersionMetadata: (
    versionId: number,
    draft: VersionMetadataDraft,
  ) => Promise<ResumeHistoryVersionListItem | null>
  restoreVersion: (
    versionId: number,
    strategy: RestoreStrategy,
  ) => Promise<ResumeHistoryVersionRecord | null>
  deleteVersion: (versionId: number) => Promise<boolean>
}

export type Set = StoreApi<HistoryStoreState>['setState']

export type Get = StoreApi<HistoryStoreState>['getState']

export interface HistoryRuntime {
  requestId: number
  accountId: string | null
  snapshotRequests: Map<number, Promise<ResumeSnapshot | null>>
}
