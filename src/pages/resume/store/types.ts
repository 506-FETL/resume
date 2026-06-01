import type { ResumeItem } from '../types'
import type { ResumeFilterMode } from './resume-ui'

export interface ResumeListState {
  // List slice
  resumes: ResumeItem[]
  loading: boolean
  _localDeletingIds: Set<string>

  loadResumes: () => Promise<void>
  deleteResume: (id: string) => void
  updateResume: (resumeId: string, updates: { display_name: string, description: string }) => void
  addResume: (resume: ResumeItem) => void

  // Sync slice
  isOnline: boolean
  offlineResumes: ResumeItem[]
  isSyncing: boolean
  syncingIds: Set<string>

  syncResumes: (selectedIds: string[]) => Promise<void>
  setupRealtimeSubscription: () => () => void

  // UI slice
  showSyncDialog: boolean
  setShowSyncDialog: (show: boolean) => void
  filterMode: ResumeFilterMode
  setFilterMode: (mode: ResumeFilterMode) => void
  derivePendingFor: string | null
  openDeriveFor: (id: string | null) => void
  derivedJobsOpen: boolean
  setDerivedJobsOpen: (open: boolean) => void
}
