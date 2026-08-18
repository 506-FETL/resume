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

export function createSyncSlice(
  set: StoreApi<ResumeState>['setState'],
  get: StoreApi<ResumeState>['getState'],
): SyncSlice {
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

      set({ isSyncing: true })
      try {
        await state.docManager.saveToSupabase(state.docHandle)
        // 使用 Automerge 文档冲突解决后的最终内容同步到 resume_config
        const resolvedDoc = state.docHandle?.doc()
        const persistedPayload = resolvedDoc
          ? buildResumeConfigPayload(state, resolvedDoc)
          // 降级：如果无法获取 Automerge 文档，使用本地状态
          : buildResumeConfigPayload(state)
        await updateResumeConfig(resumeId, persistedPayload)
        set({
          isSyncing: false,
          pendingChanges: false,
          syncError: null,
          lastSyncTime: getTimestamp(),
          appearanceDirty: false,
          entryIdMigrationReady: hasCompleteResumeEntryIds(resolvedDoc ?? state),
        })
        await notifyWorkingDocumentPersisted(
          resumeId,
          mapSourceToPersistedSnapshot(persistedPayload),
        )
      }
      catch (error) {
        set({
          isSyncing: false,
          syncError: error instanceof Error ? error.message : '同步失败',
        })
      }
    },

    manualSync: async () => {
      clearSyncTimers()
      await get().syncToSupabase()
    },
  }
}
