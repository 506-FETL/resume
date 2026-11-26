import { isOfflineResumeId } from '@/lib/resume-id'
import { getResumeHistoryVersionSnapshot } from '@/lib/supabase/resume/history/queries/versions'
import useUserStore from '@/store/user'
import { buildResumeSnapshot } from '../../utils/snapshot'
import { isCurrent, readCurrentResume } from './readers'
import { initialTimeline, pageKey, showVersionPage } from './timeline'
import type { Get, HistoryDataSlice, HistoryRuntime, Set } from './types'
import { createVersionActions } from './version-actions'

export function createHistoryDataSlice(set: Set, get: Get): HistoryDataSlice {
  const runtime: HistoryRuntime = {
    replaceKnownVersions: true,
    pages: new Map(),
    pageRequests: new Map(),
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
      runtime.replaceKnownVersions = true
      runtime.pages.clear()
      runtime.pageRequests.clear()

      set({
        snapshotGeneration: runtime.requestId,
        resumeId: null,
        currentResume: null,
        mobilePanel: 'timeline',
        timelineFocusTarget: null,
        ...initialTimeline,
        snapshotCache: {},
        snapshotErrors: {},
        error: null,
        currentResumeLoading: false,
        currentResumeError: null,
        currentResumeMissing: false,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
      })
    },
    resumeId: null,
    currentResume: null,
    ...initialTimeline,
    snapshotGeneration: 0,
    snapshotCache: {},
    snapshotErrors: {},
    error: null,
    currentResumeLoading: false,
    currentResumeError: null,
    currentResumeMissing: false,
    async loadVersionSnapshot(id) {
      const { snapshotCache, resumeId } = get()
      const cached = snapshotCache[id]

      if (cached) return cached
      if (!resumeId) return null
      if (runtime.snapshotRequests.has(id))
        return runtime.snapshotRequests.get(id)!

      const generation = runtime.requestId
      const snapshotErrors = { ...get().snapshotErrors }

      delete snapshotErrors[id]
      set({ snapshotErrors })

      const current = () =>
        isCurrent(runtime, get, generation, resumeId) &&
        runtime.snapshotRequests.get(id) === request

      const request = getResumeHistoryVersionSnapshot(id, resumeId)
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
      runtime.replaceKnownVersions = true
      runtime.pages.clear()
      runtime.pageRequests.clear()

      set({
        snapshotGeneration: activeRequestId,
        resumeId: resumeId ?? null,
        savingCurrent: false,
        savingMetadata: false,
        restoring: false,
        deletingVersionId: null,
        error: null,
        versionSummaryReady: false,
        snapshotCache: {},
        snapshotErrors: {},
        ...(!sameResume && {
          mobilePanel: 'timeline',
          timelineFocusTarget: null,
          currentResume: null,
          ...initialTimeline,
        }),
        currentResumeError: null,
        currentResumeMissing: false,
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

      await Promise.all([
        readCurrentResume(runtime, set, get, resumeId, activeRequestId),
        showVersionPage(runtime, set, get, initialTimeline.versionFilter, 0),
      ])
    },
    async reload() {
      await get().init(get().resumeId)
    },
    async reloadCurrentResume() {
      const { resumeId, currentResumeLoading } = get()

      if (!resumeId || currentResumeLoading) return

      await readCurrentResume(runtime, set, get, resumeId, runtime.requestId)
    },
    async reloadVersions() {
      const { versionFilter, versionPage } = get()

      runtime.pages.delete(pageKey(versionFilter, versionPage))
      await showVersionPage(runtime, set, get, versionFilter, versionPage)
    },
    showVersionPage: (filter, page) =>
      showVersionPage(runtime, set, get, filter, page),
    ...createVersionActions(runtime, set, get),
  }
}
