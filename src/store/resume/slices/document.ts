import type { DocHandle } from '@automerge/automerge-repo'
import type { StoreApi } from 'zustand'
import type { ResumeState } from '../form'
import type { EditorMode, ResumeLoadResult } from '../helpers/sync-service'
import type { AutomergeResumeDocument, DocumentInitializationSource } from '@/lib/automerge'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { CollaborationDocumentLoadError, DocumentManager } from '@/lib/automerge'
import { getOfflineResumeById, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { ResumeNotFoundError } from '@/lib/resume-id'
import { applyResumeEntryIdPatches, collectMissingResumeEntryIdPatches, hasCompleteResumeEntryIds } from '@/lib/schema/resume/entry-id'
import { getCurrentUser } from '@/lib/supabase/user'
import useResumeConfigStore from '../config'
import { hasPersistedAppearance, mapSnapshotToState, mapSourceToPersistedSnapshot, mergeSnapshotAppearance } from '../helpers'
import { getCloudAppearanceSource, scheduleOnlinePersist } from '../helpers/sync-service'

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

  loadResumeData: (resumeId: string, options?: ResumeLoadOptions) => Promise<ResumeLoadResult>
  cleanup: () => void
}

export interface ResumeLoadOptions {
  source?: DocumentInitializationSource
}

export const documentDefaults: Pick<DocumentSlice, 'mode' | 'currentResumeId' | 'documentDisplayName' | 'docManager' | 'docHandle' | 'cleanupFns' | 'isInitialized' | 'cloudAppearanceStatus' | 'docHasPersistedAppearance' | 'appearanceDirty' | 'entryIdMigrationReady' | 'documentChangeRevision' | 'documentSessionId'> = {
  mode: null,
  currentResumeId: null,
  documentDisplayName: null,
  docManager: null,
  docHandle: null,
  cleanupFns: [],
  isInitialized: false,
  cloudAppearanceStatus: 'not_applicable',
  docHasPersistedAppearance: false,
  appearanceDirty: false,
  entryIdMigrationReady: false,
  documentChangeRevision: 0,
  documentSessionId: 0,
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

    loadResumeData: async (resumeId: string, options?: ResumeLoadOptions) => {
      const source = options?.source ?? { kind: 'owner' }

      if (source.kind === 'collaboration' && isOfflineResumeId(resumeId))
        throw new CollaborationDocumentLoadError('离线简历不支持实时协作')

      const requestId = ++latestLoadRequestId
      const isCurrentRequest = () => requestId === latestLoadRequestId
      const assertCurrentRequest = () => {
        if (!isCurrentRequest())
          throw new ResumeLoadSupersededError()
      }

      // 切文档前先落盘；失败时保留旧文档和 pending/error，允许显式重试。
      await get().flushPendingChanges()
      assertCurrentRequest()
      await get().waitForResumePersist(resumeId)
      assertCurrentRequest()
      // 等待目标旧保存期间，源文档仍会接收协作变更。最后一次稳定 flush
      // 必须紧邻销毁；await 返回的微任务间隙若又产生变更，则继续落盘。
      let hasPendingPersistableChanges: boolean
      do {
        await get().flushPendingChanges()
        assertCurrentRequest()
        const current = get()
        hasPendingPersistableChanges = current.isInitialized && current.pendingChanges
          && (current.mode === 'offline' || current.docManager?.canPersist() === true)
      } while (hasPendingPersistableChanges)
      const { docManager, cleanupFns } = get()
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
        documentDisplayName: null,
        mode: isOfflineResumeId(resumeId) ? 'offline' : 'online',
        isInitialized: false,
        cloudAppearanceStatus: source.kind === 'collaboration' ? 'not_applicable' : 'error',
        entryIdMigrationReady: false,
        documentChangeRevision: 0,
        documentSessionId: get().documentSessionId + 1,
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
          documentDisplayName: offlineResume.display_name,
          isInitialized: true,
          lastSyncTime: offlineResume.updated_at ? dayjs(offlineResume.updated_at).valueOf() : null,
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

      const user = await getCurrentUser()
      assertCurrentRequest()
      if (!user) {
        throw new Error('用户未登录')
      }

      let manager: DocumentManager | null = null
      try {
        // 自有云端简历先验证 resume_config 行存在，避免已删除的 UUID 被初始化成一份空白 Automerge 文档。
        // 协作来源已经由 Edge 返回的 bootstrap 鉴权，不得再读 owner-only 外观数据或回退 owner 文档。
        const initialCloudAppearanceResult = source.kind === 'owner'
          ? await getCloudAppearanceSource(resumeId)
          : null
        assertCurrentRequest()
        if (initialCloudAppearanceResult?.resumeExists === false)
          throw new ResumeNotFoundError()

        manager = new DocumentManager(resumeId, user.id, {
          source,
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
        const cloudAppearanceResult = source.kind === 'owner'
          ? initialCloudAppearanceResult ?? await getCloudAppearanceSource(resumeId)
          : null
        assertCurrentRequest()
        const cloudHasPersistedAppearance = cloudAppearanceResult?.status === 'present'
        const docHasPersistedAppearance = hasPersistedAppearance(doc)
        const snapshot = cloudHasPersistedAppearance && cloudAppearanceResult
          ? mergeSnapshotAppearance(docSnapshot, cloudAppearanceResult.appearance)
          : docSnapshot
        const cloudAppearanceStatus = cloudAppearanceResult?.status ?? 'not_applicable'

        const changeHandler = ({ doc }: { doc: AutomergeResumeDocument | null }) => {
          // 新 load 等待旧文档落盘期间，旧文档仍是当前编辑目标。
          // 用实际 manager/handle 身份隔离回调，切换失败后旧文档也能继续编辑。
          if (!doc || get().docManager !== manager || get().docHandle !== handle)
            return

          const nextSnapshot = mapSourceToPersistedSnapshot(doc)
          const canPersist = manager?.canPersist() === true
          // 合并后的 Automerge 文档是 owner 与 guest 的共同外观真源。
          // replaceConfig 仅更新本地 store，不会触发反向写入。
          useResumeConfigStore.getState().replaceConfig(nextSnapshot)

          set(prev => ({
            ...prev,
            ...mapSnapshotToState(nextSnapshot),
            isInitialized: true,
            pendingChanges: canPersist ? true : prev.pendingChanges,
            documentChangeRevision: canPersist
              ? prev.documentChangeRevision + 1
              : prev.documentChangeRevision,
            entryIdMigrationReady: prev.entryIdMigrationReady && hasCompleteResumeEntryIds(doc),
          }))

          if (canPersist) {
            const persist = get().capturePersistRequest()
            if (persist)
              scheduleOnlinePersist(persist)
          }
        }

        handle.on('change', changeHandler)
        const offChange = () => handle.off('change', changeHandler)

        assertCurrentRequest()
        set({
          ...mapSnapshotToState(snapshot),
          docManager: manager,
          documentDisplayName: cloudAppearanceResult?.displayName ?? null,
          docHandle: handle,
          cleanupFns: [offChange],
          isSyncing: false,
          pendingChanges: false,
          syncError: null,
          mode: 'online',
          isInitialized: true,
          cloudAppearanceStatus,
          docHasPersistedAppearance,
          appearanceDirty: false,
          entryIdMigrationReady: entryIdPatches.length === 0 && hasCompleteResumeEntryIds(doc),
          documentChangeRevision: 0,
        })

        if (entryIdPatches.length > 0 && source.kind === 'owner') {
          await get().syncToSupabase()
          assertCurrentRequest()
        }

        return {
          snapshot,
          hasPersistedAppearance: cloudHasPersistedAppearance || docHasPersistedAppearance,
          cloudAppearanceStatus,
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
          cloudAppearanceStatus: source.kind === 'collaboration' ? 'not_applicable' : 'error',
          entryIdMigrationReady: false,
        })
        throw error
      }
    },

    cleanup: () => {
      latestLoadRequestId += 1
      get().flushPendingChanges().catch(error => toast.error(`离开前保存失败：${error instanceof Error ? error.message : '同步失败'}`))
      const { cleanupFns, docManager } = get()
      cleanupFns.forEach(fn => fn())
      docManager?.destroy()
      set({
        cleanupFns: [],
        docManager: null,
        docHandle: null,
        mode: null,
        currentResumeId: null,
        documentDisplayName: null,
        isInitialized: false,
        cloudAppearanceStatus: 'not_applicable',
        docHasPersistedAppearance: false,
        appearanceDirty: false,
        entryIdMigrationReady: false,
        documentChangeRevision: 0,
        documentSessionId: get().documentSessionId + 1,
        isSyncing: false,
      })
    },
  }
}
