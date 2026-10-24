import type { StoreApi } from 'zustand'
import type { ResumeState } from '../form'
import { next as Automerge } from '@automerge/automerge'
import { cloneDeep } from 'lodash'
import { notifyWorkingDocumentPersisted } from '@/features/resume-comments/api/working-document-sync.ts'
import {
  isOfflineResumeId,
  updateOfflineResume,
} from '@/lib/offline-resume-manager'
import { hasCompleteResumeEntryIds } from '@/lib/schema/resume/entry-id'
import { updateResumeConfig } from '@/lib/supabase/resume'
import { getTimestamp } from '@/utils/date'
import { mapSourceToPersistedSnapshot } from '../helpers'
import {
  buildResumeConfigPayload,
  clearSyncTimers,
  getPersistedSnapshot,
} from '../helpers/sync-service'

export interface SyncSlice {
  isSyncing: boolean
  lastSyncTime: number | null
  syncError: string | null
  pendingChanges: boolean

  capturePersistRequest: () => (() => Promise<void>) | null
  flushPendingChanges: () => Promise<void>
  waitForResumePersist: (resumeId: string) => Promise<void>
  syncToSupabase: () => Promise<void>
  manualSync: () => Promise<void>
}

export const syncDefaults: Pick<
  SyncSlice,
  'isSyncing' | 'lastSyncTime' | 'syncError' | 'pendingChanges'
> = {
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  pendingChanges: false,
}

export function createSyncSlice(
  set: StoreApi<ResumeState>['setState'],
  get: StoreApi<ResumeState>['getState'],
): SyncSlice {
  // 同一简历的旧、新快照串行落盘；不同简历不互相阻塞。
  const operations = new Map<string, Promise<void>>()
  const failedRequests = new Map<string, () => Promise<void>>()

  const capturePersistRequest = (): (() => Promise<void>) | null => {
    const state = get()
    const resumeId = state.currentResumeId

    if (!resumeId || !state.isInitialized) return null

    const offline = state.mode === 'offline' || isOfflineResumeId(resumeId)
    const manager = state.docManager
    const handle = state.docHandle

    if (!offline && (!manager || !handle || !manager.canPersist())) return null

    const session = state.documentSessionId
    const revision = state.documentChangeRevision
    const sourceDoc = offline ? undefined : handle?.doc()

    if (!offline && !sourceDoc) throw new Error('简历文档尚未就绪，无法保存')

    // doc 的字段视图不可变，但 save() 会读取共享后端的新变化；排队前必须 clone。
    const doc = sourceDoc ? Automerge.clone(sourceDoc) : undefined
    // 普通表单与外观也必须在切换前深拷贝。
    const snapshot = cloneDeep(getPersistedSnapshot(state))

    const payload = offline
      ? null
      : cloneDeep(buildResumeConfigPayload(state, doc))

    const isCurrent = (current: ResumeState) =>
      current.currentResumeId === resumeId &&
      current.documentSessionId === session

    let operation: Promise<void> | null = null

    const persist = () => {
      if (operation) return operation

      const previous = operations.get(resumeId) ?? Promise.resolve()

      operation = previous
        .catch(() => undefined)
        .then(async () => {
          set((current) => (isCurrent(current) ? { isSyncing: true } : {}))

          try {
            if (offline) {
              await updateOfflineResume(resumeId, snapshot)
            } else {
              await manager!.saveToSupabase(handle, doc)
              // 即使当前编辑器已经切换，也必须完成旧文档配置与评论通道的写入。
              await updateResumeConfig(resumeId, payload!)

              await notifyWorkingDocumentPersisted(
                resumeId,
                mapSourceToPersistedSnapshot(payload!),
              )
            }

            set((current) => {
              if (!isCurrent(current)) return {}

              const stable = current.documentChangeRevision === revision

              return {
                isSyncing: false,
                pendingChanges: !stable,
                syncError: null,
                lastSyncTime: getTimestamp(),
                ...(stable
                  ? {
                      appearanceDirty: false,
                      entryIdMigrationReady:
                        !offline && hasCompleteResumeEntryIds(doc!),
                    }
                  : {}),
              }
            })
          } catch (error) {
            set((current) =>
              isCurrent(current)
                ? {
                    isSyncing: false,
                    pendingChanges: true,
                    syncError:
                      error instanceof Error ? error.message : '同步失败',
                  }
                : {},
            )

            throw error
          }
        })

      operations.set(resumeId, operation)

      const request = operation

      request.then(
        () => {
          if (operations.get(resumeId) === request) {
            operations.delete(resumeId)
            failedRequests.delete(resumeId)
          }
        },
        () => {
          // 仅保留当前会话中最后失败的捕获快照，重开简历时先重试。
          operation = null

          if (operations.get(resumeId) === request)
            failedRequests.set(resumeId, persist)
        },
      )

      return operation
    }

    return persist
  }

  return {
    ...syncDefaults,
    capturePersistRequest,

    flushPendingChanges: async () => {
      clearSyncTimers()

      const state = get()
      const persist = state.pendingChanges ? capturePersistRequest() : null

      await (persist?.() ??
        (state.currentResumeId ? operations.get(state.currentResumeId) : null))

      // 切换等待期间仍可能输入；卸载已改变 session 时只保存捕获的旧快照。
      if (
        persist &&
        get().documentSessionId === state.documentSessionId &&
        get().pendingChanges
      )
        await get().flushPendingChanges()
    },

    waitForResumePersist: async (resumeId) => {
      try {
        await operations.get(resumeId)
      } catch (error) {
        const retry = failedRequests.get(resumeId)

        if (!retry) throw error

        await retry()
      }
    },

    syncToSupabase: async () => {
      const session = get().documentSessionId

      try {
        do {
          const persist = capturePersistRequest()

          if (!persist) return

          await persist()
        } while (get().documentSessionId === session && get().pendingChanges)
      } catch {
        // capture request 已保留 pending/error；手动保存沿用状态检查接口。
      }
    },

    manualSync: async () => {
      clearSyncTimers()
      await get().syncToSupabase()
    },
  }
}
