import type { AutomergeResumeDocument } from '@/lib/automerge'
import { getOfflineResumeById } from '@/lib/offline-resume-manager'
import dayjs from 'dayjs'
import type { StoreApi } from 'zustand'
import type { ResumeState } from '../../form'
import {
  hasPersistedAppearance,
  mapSnapshotToState,
  mapSourceToPersistedSnapshot,
} from '../../helpers'
import type { ResumeLoadResult } from '../../helpers/sync-service'
import { preloadTemplate } from './template'

export async function loadOfflineDocument(
  set: StoreApi<ResumeState>['setState'],
  resumeId: string,
  assertCurrentRequest: () => void,
): Promise<ResumeLoadResult> {
  const offlineResume = await getOfflineResumeById(resumeId)

  assertCurrentRequest()

  if (!offlineResume) {
    throw new Error('离线简历不存在')
  }

  const data = offlineResume.data || {}

  const snapshot = mapSourceToPersistedSnapshot(
    data as Partial<AutomergeResumeDocument>,
  )

  preloadTemplate(snapshot.templateBinding)

  set({
    ...mapSnapshotToState(snapshot),
    isSyncing: false,
    pendingChanges: false,
    syncError: null,
    mode: 'offline',
    documentDisplayName: offlineResume.display_name,
    documentParentResumeId: offlineResume.parent_resume_id ?? null,
    isInitialized: true,
    lastSyncTime: offlineResume.updated_at
      ? dayjs(offlineResume.updated_at).valueOf()
      : null,
    cloudAppearanceStatus: 'not_applicable',
    docHasPersistedAppearance: hasPersistedAppearance(data),
    appearanceDirty: false,
    entryIdMigrationReady: false,
    documentChangeRevision: 0,
  })

  return {
    snapshot,
    hasPersistedAppearance: hasPersistedAppearance(data),
    cloudAppearanceStatus: 'not_applicable',
    mode: 'offline',
  }
}
