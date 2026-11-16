import type {
  AutomergeResumeDocument,
  DocumentInitializationSource,
  DocumentManager,
} from '@/lib/automerge'
import type { DocHandle } from '@automerge/automerge-repo'
import type { EditorMode, ResumeLoadResult } from '../../helpers/sync-service'

export interface DocumentSlice {
  mode: EditorMode
  currentResumeId: string | null
  documentDisplayName: string | null
  docManager: DocumentManager | null
  docHandle: DocHandle<AutomergeResumeDocument> | null
  cleanupFns: Array<() => void>
  isInitialized: boolean
  cloudAppearanceStatus: ResumeLoadResult['cloudAppearanceStatus']
  docHasPersistedAppearance: boolean
  appearanceDirty: boolean
  entryIdMigrationReady: boolean
  documentChangeRevision: number
  documentSessionId: number

  loadResumeData: (
    resumeId: string,
    options?: ResumeLoadOptions,
  ) => Promise<ResumeLoadResult>
  cleanup: () => void
}

export interface ResumeLoadOptions {
  source?: DocumentInitializationSource
}
