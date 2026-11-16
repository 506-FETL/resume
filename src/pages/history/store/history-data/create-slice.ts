import { isOfflineResumeId } from '@/lib/offline-resume-manager'
import { getResumeHistoryVersionSnapshot } from '@/lib/supabase/resume/history/queries'
import useUserStore from '@/store/user'
import { buildResumeSnapshot } from '../../utils'
import { hydrate, isCurrent, readCurrentResume, readVersions } from './readers'
import type { Get, HistoryDataSlice, HistoryRuntime, Set } from './types'
import { createVersionActions } from './version-actions'

export function createHistoryDataSlice(set: Set, get: Get): HistoryDataSlice {
  const runtime: HistoryRuntime = {
    requestId: 0,
    accountId: useUserStore.getState().currentUser?.id ?? null,
    snapshotRequests: new Map(),
  }

  return {
    resetAccount(nextAccountId) {
      if (runtime.accountId === nextAccountId) return

      runtime.accountId = nextAccountId
      runtime.requestId += 1
      runtime.snapshotRequests.clear()

      set({
        snapshotGeneration: runtime.requestId,
        resumeId: null,
        currentResume: null,
        versions: [],
        snapshotCache: {},
        snapshotErrors: {},
        error: null,
        currentResumeLoading: false,
        currentResumeError: null,
        versionsLoading: false,
        versionsError: null,
        versionsLoaded: false,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
      })
    },
    resumeId: null,
    currentResume: null,
    versions: [],
    snapshotGeneration: 0,
    snapshotCache: {},
    snapshotErrors: {},
    error: null,
    currentResumeLoading: false,
    currentResumeError: null,
    versionsLoading: false,
    versionsError: null,
    versionsLoaded: false,
    async loadVersionSnapshot(id) {
      const { snapshotCache, resumeId, versions } = get()
      const cached = snapshotCache[id]

      if (cached) return cached
      if (!resumeId || !versions.some((version) => version.id === id))
        return null
      if (runtime.snapshotRequests.has(id))
        return runtime.snapshotRequests.get(id)!

      const generation = runtime.requestId
      const snapshotErrors = { ...get().snapshotErrors }

      delete snapshotErrors[id]
      set({ snapshotErrors })

      const current = () =>
        isCurrent(runtime, get, generation, resumeId) &&
        runtime.snapshotRequests.get(id) === request &&
        get().versions.some((version) => version.id === id)

      const request = getResumeHistoryVersionSnapshot(id)
        .then((raw) => {
          if (!current()) return null

          const snapshot = buildResumeSnapshot(raw)

          set((state) => ({
            snapshotCache: { ...state.snapshotCache, [id]: snapshot },
          }))

          return snapshot
        })
        .catch((error: unknown) => {
          if (current())
            set((state) => ({
              snapshotErrors: {
                ...state.snapshotErrors,
                [id]:
                  error instanceof Error ? error.message : '加载版本内容失败',
              },
            }))

          return null
        })
        .finally(() => {
          if (runtime.snapshotRequests.get(id) === request)
            runtime.snapshotRequests.delete(id)
        })

      runtime.snapshotRequests.set(id, request)

      return request
    },
    async init(resumeId) {
      const activeRequestId = ++runtime.requestId
      const sameResume = get().resumeId === resumeId

      runtime.snapshotRequests.clear()

      set({
        snapshotGeneration: activeRequestId,
        resumeId: resumeId ?? null,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
        error: null,
        ...(!sameResume && {
          currentResume: null,
          versions: [],
          versionsLoaded: false,
          snapshotCache: {},
          snapshotErrors: {},
        }),
        currentResumeError: null,
        versionsError: null,
      })

      if (!resumeId || isOfflineResumeId(resumeId)) {
        set({
          currentResumeLoading: false,
          versionsLoading: false,
          error: resumeId
            ? '当前仅支持查看云端简历的版本记录，请先同步到云端。'
            : null,
        })

        return
      }

      await hydrate(runtime, set, get, resumeId, activeRequestId)
    },
    async reload() {
      const resumeId = get().resumeId

      if (!resumeId) return

      const activeRequestId = ++runtime.requestId

      runtime.snapshotRequests.clear()
      set({ snapshotGeneration: activeRequestId, error: null })
      await hydrate(runtime, set, get, resumeId, activeRequestId)
    },
    async reloadCurrentResume() {
      const { resumeId, currentResumeLoading } = get()

      if (!resumeId || currentResumeLoading) return

      await readCurrentResume(runtime, set, get, resumeId, runtime.requestId)
    },
    async reloadVersions() {
      const { resumeId, versionsLoading } = get()

      if (!resumeId || versionsLoading) return

      await readVersions(runtime, set, get, resumeId, runtime.requestId)
    },
    ...createVersionActions(runtime, set, get),
  }
}
