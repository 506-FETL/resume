import type { StoreApi } from 'zustand'
import type { ResumeState } from '../form'
import { notifyWorkingDocumentPersisted } from '@/features/resume-comments/api/working-document-sync.ts'
import { isOfflineResumeId, updateOfflineResume } from '@/lib/offline-resume-manager'
import { hasCompleteResumeEntryIds } from '@/lib/schema/resume/entry-id'
import { updateResumeConfig } from '@/lib/supabase/resume'
import { getTimestamp } from '@/utils/date'
import useCurrentResumeStore from '../current'
import { mapSourceToPersistedSnapshot } from '../helpers'
import { buildResumeConfigPayload, clearSyncTimers, getPersistedSnapshot } from '../helpers/sync-service'

export interface SyncSlice {
  isSyncing: boolean
  lastSyncTime: number | null
  syncError: string | null
  pendingChanges: boolean

  syncToSupabase: () => Promise<void>
  manualSync: () => Promise<void>
}

export const syncDefaults: Pick<SyncSlice, 'isSyncing' | 'lastSyncTime' | 'syncError' | 'pendingChanges'> = {
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  pendingChanges: false,
}

type OnlineSyncManager = NonNullable<ResumeState['docManager']>
type OnlineSyncHandle = NonNullable<ResumeState['docHandle']>

interface OnlineSyncTarget {
  manager: OnlineSyncManager
  handle: OnlineSyncHandle
  resumeId: string
  revision: number
}

interface OnlineSyncOutcome extends OnlineSyncTarget {
  status: 'stable' | 'failed'
}

export function createSyncSlice(
  set: StoreApi<ResumeState>['setState'],
  get: StoreApi<ResumeState>['getState'],
): SyncSlice {
  let onlineSyncOperation: Promise<OnlineSyncOutcome> | null = null

  const resolveResumeId = (state: ResumeState) =>
    state.currentResumeId ?? useCurrentResumeStore.getState().resumeId

  const getOnlineTarget = (state: ResumeState): OnlineSyncTarget | null => {
    const resumeId = resolveResumeId(state)
    if (
      !resumeId
      || state.mode !== 'online'
      || !state.docManager
      || !state.docHandle
      || !state.docManager.canPersist()
    ) {
      return null
    }

    return {
      manager: state.docManager,
      handle: state.docHandle,
      resumeId,
      revision: state.documentChangeRevision,
    }
  }

  const isCurrentTarget = (state: ResumeState, target: OnlineSyncTarget) =>
    state.mode === 'online'
    && state.docManager === target.manager
    && state.docHandle === target.handle
    && resolveResumeId(state) === target.resumeId

  const drainOnlineSync = async (initialTarget: OnlineSyncTarget): Promise<OnlineSyncOutcome> => {
    let lastTarget = initialTarget

    while (true) {
      const state = get()
      const target = getOnlineTarget(state)
      if (!target) {
        return { ...lastTarget, status: 'stable' }
      }
      lastTarget = target

      try {
        const resolvedDoc = target.handle.doc()
        const persistedPayload = resolvedDoc
          ? buildResumeConfigPayload(state, resolvedDoc)
          : buildResumeConfigPayload(state)
        set(prev => isCurrentTarget(prev, target)
          ? { isSyncing: true }
          : {})

        await target.manager.saveToSupabase(target.handle)
        if (!isCurrentTarget(get(), target)) {
          continue
        }
        if (get().documentChangeRevision !== target.revision) {
          continue
        }

        // 每一轮都使用该 revision 对应的 Automerge 不可变快照，确保三段写入有序。
        await updateResumeConfig(target.resumeId, persistedPayload)
        if (!isCurrentTarget(get(), target)) {
          continue
        }
        if (get().documentChangeRevision !== target.revision) {
          continue
        }

        await notifyWorkingDocumentPersisted(
          target.resumeId,
          mapSourceToPersistedSnapshot(persistedPayload),
        )
        if (!isCurrentTarget(get(), target)) {
          continue
        }
        if (get().documentChangeRevision !== target.revision) {
          continue
        }

        const latestState = get()
        const isStable = latestState.documentChangeRevision === target.revision
        set(prev => isCurrentTarget(prev, target)
          ? {
              isSyncing: !isStable,
              pendingChanges: !isStable,
              syncError: null,
              lastSyncTime: getTimestamp(),
              ...(isStable
                ? {
                    appearanceDirty: false,
                    entryIdMigrationReady: hasCompleteResumeEntryIds(resolvedDoc ?? state),
                  }
                : {}),
            }
          : {})

        if (isStable) {
          return { ...target, status: 'stable' }
        }
      }
      catch (error) {
        if (!isCurrentTarget(get(), target)) {
          continue
        }

        set(prev => isCurrentTarget(prev, target)
          ? {
              isSyncing: false,
              pendingChanges: true,
              syncError: error instanceof Error ? error.message : '同步失败',
            }
          : {})
        return { ...target, status: 'failed' }
      }
    }
  }

  const syncOnlineTarget = async (request: OnlineSyncTarget): Promise<void> => {
    let operation = onlineSyncOperation
    if (!operation) {
      const drainPromise = drainOnlineSync(request)
      operation = drainPromise.finally(() => {
        if (onlineSyncOperation === operation) {
          onlineSyncOperation = null
        }
      })
      onlineSyncOperation = operation
    }

    const outcome = await operation
    const latestTarget = getOnlineTarget(get())
    if (!latestTarget || !isCurrentTarget(get(), request)) {
      return
    }

    // 同一请求等待旧 operation 后重新评估；当前 target 未被该 operation
    // 稳定保存时开启下一轮。当前 target 自身失败则保留 pending/error 等待显式重试。
    const outcomeMatchesCurrent = isCurrentTarget(get(), outcome)
    if (outcome.status === 'failed' && outcomeMatchesCurrent) {
      return
    }
    if (
      !outcomeMatchesCurrent
      || latestTarget.revision !== outcome.revision
      || get().pendingChanges
    ) {
      await syncOnlineTarget(latestTarget)
    }
  }

  return {
    ...syncDefaults,

    syncToSupabase: async () => {
      const state = get()
      const resumeId = state.currentResumeId ?? useCurrentResumeStore.getState().resumeId

      if (!resumeId) {
        return
      }

      set({ isSyncing: true })

      if (state.mode === 'offline' || isOfflineResumeId(resumeId)) {
        try {
          await updateOfflineResume(resumeId, getPersistedSnapshot(state))
          set({
            pendingChanges: false,
            isSyncing: false,
            syncError: null,
            lastSyncTime: getTimestamp(),
          })
        }
        catch (error) {
          set({
            isSyncing: false,
            syncError: error instanceof Error ? error.message : '同步失败',
          })
        }
        return
      }

      if (!state.docManager || !state.docHandle) {
        set({ isSyncing: false })
        return
      }

      if (!state.docManager.canPersist()) {
        set({
          isSyncing: false,
          pendingChanges: false,
          syncError: null,
          lastSyncTime: getTimestamp(),
        })
        return
      }

      const target = getOnlineTarget(state)
      if (!target) {
        set({ isSyncing: false })
        return
      }

      await syncOnlineTarget(target)
    },

    manualSync: async () => {
      clearSyncTimers()
      await get().syncToSupabase()
    },
  }
}
