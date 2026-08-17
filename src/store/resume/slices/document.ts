import type { DocHandle } from '@automerge/automerge-repo'
import type { StoreApi } from 'zustand'
import type { ResumeState } from '../form'
import type { EditorMode, ResumeLoadResult } from '../helpers/sync-service'
import type { AutomergeResumeDocument } from '@/lib/automerge'
import dayjs from 'dayjs'
import { DocumentManager } from '@/lib/automerge'
import { getOfflineResumeById, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { ResumeNotFoundError } from '@/lib/resume-id'
import { applyResumeEntryIdPatches, collectMissingResumeEntryIdPatches, hasCompleteResumeEntryIds } from '@/lib/schema/resume/entry-id'
import { getCurrentUser } from '@/lib/supabase/user'
import { getTimestamp } from '@/utils/date'
import { hasPersistedAppearance, mapSnapshotToState, mapSourceToPersistedSnapshot, mergeSnapshotAppearance } from '../helpers'
import { clearSyncTimers, getCloudAppearanceSource } from '../helpers/sync-service'

export interface DocumentSlice {
  mode: EditorMode
  currentResumeId: string | null
  docManager: DocumentManager | null
  docHandle: DocHandle<AutomergeResumeDocument> | null
  cleanupFns: Array<() => void>
  isInitialized: boolean
  cloudAppearanceStatus: ResumeLoadResult['cloudAppearanceStatus']
  docHasPersistedAppearance: boolean
  appearanceDirty: boolean
  entryIdMigrationReady: boolean

  loadResumeData: (resumeId: string, options?: { documentUrl?: string }) => Promise<ResumeLoadResult>
  cleanup: () => void
}

export const documentDefaults: Pick<DocumentSlice, 'mode' | 'currentResumeId' | 'docManager' | 'docHandle' | 'cleanupFns' | 'isInitialized' | 'cloudAppearanceStatus' | 'docHasPersistedAppearance' | 'appearanceDirty' | 'entryIdMigrationReady'> = {
  mode: null,
  currentResumeId: null,
  docManager: null,
  docHandle: null,
  cleanupFns: [],
  isInitialized: false,
  cloudAppearanceStatus: 'not_applicable',
  docHasPersistedAppearance: false,
  appearanceDirty: false,
  entryIdMigrationReady: false,
}

class ResumeLoadSupersededError extends Error {
  constructor() {
    super('简历加载已被新的请求替代')
    this.name = 'ResumeLoadSupersededError'
  }
}

export function createDocumentSlice(
  set: StoreApi<ResumeState>['setState'],
  get: StoreApi<ResumeState>['getState'],
): DocumentSlice {
  let latestLoadRequestId = 0

  return {
    ...documentDefaults,

    loadResumeData: async (resumeId: string, options?: { documentUrl?: string }) => {
      const requestId = ++latestLoadRequestId
      const isCurrentRequest = () => requestId === latestLoadRequestId
      const assertCurrentRequest = () => {
        if (!isCurrentRequest())
          throw new ResumeLoadSupersededError()
      }
      const { docManager, cleanupFns } = get()

      clearSyncTimers()
      if (cleanupFns.length > 0) {
        cleanupFns.forEach(fn => fn())
      }
      if (docManager) {
        docManager.destroy()
      }

      set({
        isSyncing: true,
        syncError: null,
        pendingChanges: false,
        docManager: null,
        docHandle: null,
        cleanupFns: [],
        currentResumeId: resumeId,
        mode: isOfflineResumeId(resumeId) ? 'offline' : 'online',
        isInitialized: false,
        entryIdMigrationReady: false,
      })

      if (isOfflineResumeId(resumeId)) {
        const offlineResume = await getOfflineResumeById(resumeId)
        assertCurrentRequest()
        if (!offlineResume) {
          throw new Error('离线简历不存在')
        }

        const data = offlineResume.data || {}
        const snapshot = mapSourceToPersistedSnapshot(data as Partial<AutomergeResumeDocument>)

        set({
          ...mapSnapshotToState(snapshot),
          isSyncing: false,
          pendingChanges: false,
          syncError: null,
          mode: 'offline',
          isInitialized: true,
          lastSyncTime: offlineResume.updated_at ? dayjs(offlineResume.updated_at).valueOf() : null,
          cloudAppearanceStatus: 'not_applicable',
          docHasPersistedAppearance: hasPersistedAppearance(data),
          appearanceDirty: false,
          entryIdMigrationReady: false,
        })
        return {
          snapshot,
          hasPersistedAppearance: hasPersistedAppearance(data),
          cloudAppearanceStatus: 'not_applicable',
          mode: 'offline',
        }
      }

      const user = await getCurrentUser()
      assertCurrentRequest()
      if (!user) {
        throw new Error('用户未登录')
      }

      let manager: DocumentManager | null = null
      try {
        // 自有云端简历先验证 resume_config 行存在，避免已删除的 UUID 被初始化成一份空白 Automerge 文档。
        // 共享 documentUrl 可能不允许当前用户读取所有者的 resume_config，因此保留原共享加载路径。
        const initialCloudAppearanceResult = options?.documentUrl
          ? null
          : await getCloudAppearanceSource(resumeId)
        assertCurrentRequest()
        if (initialCloudAppearanceResult?.resumeExists === false)
          throw new ResumeNotFoundError()

        manager = new DocumentManager(resumeId, user.id, {
          sharedDocumentUrl: options?.documentUrl,
        })
        const handle = await manager.initialize()
        assertCurrentRequest()
        const sourceDoc = handle.doc()
        let docSnapshot = mapSourceToPersistedSnapshot(sourceDoc)
        const entryIdPatches = collectMissingResumeEntryIdPatches(sourceDoc, docSnapshot)

        if (entryIdPatches.length > 0) {
          manager.change((doc) => {
            applyResumeEntryIdPatches(doc, entryIdPatches)
          })
          docSnapshot = mapSourceToPersistedSnapshot(handle.doc())
        }

        const doc = handle.doc()
        const cloudAppearanceResult = initialCloudAppearanceResult ?? await getCloudAppearanceSource(resumeId)
        assertCurrentRequest()
        const cloudHasPersistedAppearance = cloudAppearanceResult.status === 'present'
        const docHasPersistedAppearance = hasPersistedAppearance(doc)
        const snapshot = cloudHasPersistedAppearance
          ? mergeSnapshotAppearance(docSnapshot, cloudAppearanceResult.appearance)
          : docSnapshot

        const changeHandler = ({ doc }: { doc: AutomergeResumeDocument | null }) => {
          if (!doc || !isCurrentRequest())
            return

          set(prev => ({
            ...prev,
            ...mapSnapshotToState(mapSourceToPersistedSnapshot(doc)),
            isInitialized: true,
            entryIdMigrationReady: prev.entryIdMigrationReady && hasCompleteResumeEntryIds(doc),
          }))
        }

        handle.on('change', changeHandler)
        const offChange = () => handle.off('change', changeHandler)

        const offSaveStart = manager.onSaveStart(() => {
          if (!isCurrentRequest())
            return
          set({ isSyncing: true })
        })

        const offSave = manager.onSaveResult(({ success, error }) => {
          if (!isCurrentRequest())
            return
          if (success) {
            set({
              isSyncing: false,
              pendingChanges: false,
              syncError: null,
              lastSyncTime: getTimestamp(),
            })
          }
          else {
            set({
              isSyncing: false,
              syncError: error instanceof Error ? error.message : '同步失败',
            })
          }
        })

        assertCurrentRequest()
        set({
          ...mapSnapshotToState(snapshot),
          docManager: manager,
          docHandle: handle,
          cleanupFns: [offChange, offSaveStart, offSave],
          isSyncing: false,
          pendingChanges: false,
          syncError: null,
          mode: 'online',
          isInitialized: true,
          cloudAppearanceStatus: cloudAppearanceResult.status,
          docHasPersistedAppearance,
          appearanceDirty: false,
          entryIdMigrationReady: entryIdPatches.length === 0 && hasCompleteResumeEntryIds(doc),
        })

        if (entryIdPatches.length > 0) {
          await get().syncToSupabase()
          assertCurrentRequest()
        }

        return {
          snapshot,
          hasPersistedAppearance: cloudHasPersistedAppearance || docHasPersistedAppearance,
          cloudAppearanceStatus: cloudAppearanceResult.status,
          mode: 'online',
        }
      }
      catch (error) {
        if (!isCurrentRequest()) {
          manager?.destroy()
          throw new ResumeLoadSupersededError()
        }

        manager?.destroy()
        set({
          isSyncing: false,
          syncError: error instanceof Error ? error.message : '初始化失败',
          mode: 'online',
          cloudAppearanceStatus: 'error',
          entryIdMigrationReady: false,
        })
        throw error
      }
    },

    cleanup: () => {
      latestLoadRequestId += 1
      const { cleanupFns, docManager } = get()
      cleanupFns.forEach(fn => fn())
      docManager?.destroy()
      clearSyncTimers()
      set({
        cleanupFns: [],
        docManager: null,
        docHandle: null,
        mode: null,
        currentResumeId: null,
        isInitialized: false,
        cloudAppearanceStatus: 'not_applicable',
        docHasPersistedAppearance: false,
        appearanceDirty: false,
        entryIdMigrationReady: false,
      })
    },
  }
}
