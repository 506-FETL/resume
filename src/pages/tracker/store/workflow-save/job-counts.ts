import {
  getTrackerJobCounts,
  type TrackerCounts,
  type TrackerHistoryCounts,
} from '@/lib/supabase/resume/company/tracker-pages'
import {
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../lib/account-scope'
import { getTrackerErrorMessage } from '../../utils/errors'
import type { PersistenceRuntime } from './runtime'
import { filterJobs } from '../../utils/filtering'
import { isJobPendingFollowUp } from '../../utils/follow-up'
import { trackerQuery } from './job-query'

export function createJobCounts(
  { get, set }: PersistenceRuntime,
  completedBase: (archived: boolean) => Set<string> | undefined,
) {
  const cache = new Map<string, TrackerCounts>()
  const pending = new Map<string, Promise<void>>()

  let history: TrackerHistoryCounts | undefined

  let batchDepth = 0
  let dirty = false
  let version = 0
  let localKey: string | undefined
  let activeKey: string | undefined

  const refreshJobCounts = (force = true): Promise<void> => {
    const scope = getTrackerAccountScope()

    if (!scope.userId) return Promise.resolve()

    if (force && batchDepth) {
      dirty = true

      return Promise.resolve()
    }

    const state = get()
    const { base, baseKey } = trackerQuery(state, 'list')

    if (force) {
      cache.clear()
      localKey = undefined
      history = undefined
      version++
    }

    const globalIds = baseKey !== '{}' && completedBase(state.showArchived)
    const computedKey = String(state.showArchived) + baseKey

    if (!force && history && globalIds && !cache.has(baseKey)) {
      if (localKey !== computedKey) {
        const counts: TrackerCounts = {
          active: {},
          archived: {},
          pending: 0,
          pendingByStage: {},
          ...history,
        }

        const scope = state.showArchived ? counts.archived : counts.active

        const jobs = state.jobs.filter(
          (job) =>
            globalIds.has(job.id) &&
            (!base.companyId || job.tracker_company_id === base.companyId),
        )

        for (const job of filterJobs(
          jobs,
          null,
          base.keyword ?? '',
          state.showArchived,
          null,
          base.focused,
        )) {
          scope[job.status] = (scope[job.status] ?? 0) + 1

          if (isJobPendingFollowUp(job)) {
            counts.pending++

            counts.pendingByStage[job.status] =
              (counts.pendingByStage[job.status] ?? 0) + 1
          }
        }

        set({ countsKey: baseKey, counts, countsError: null })
      }

      localKey = computedKey
      activeKey = baseKey

      return Promise.resolve()
    }

    const changed = baseKey !== activeKey || localKey !== undefined

    localKey = undefined

    activeKey = baseKey

    if (changed)
      set({
        countsKey: baseKey,
        counts: cache.get(baseKey) ?? null,
        countsError: null,
      })
    if (!force && (cache.has(baseKey) || (!changed && get().countsError)))
      return Promise.resolve()

    const key = baseKey
    const previous = pending.get(key)

    if (previous) return previous

    const revision = version

    if (get().countsError) set({ countsError: null })

    const prior = history

    const task = getTrackerJobCounts(base, !prior)
      .then((counts) => {
        if (!isTrackerAccountScopeCurrent(scope) || version !== revision) return

        if (prior) counts = { ...counts, ...prior }

        history = prior ?? {
          historicalApplied: counts.historicalApplied,
          responded: counts.responded,
          unresolvedSubmissions: counts.unresolvedSubmissions,
          archivedTotal: counts.archivedTotal,
        }

        cache.set(baseKey, counts)

        if (activeKey === baseKey)
          set({ counts, historyCounts: history, countsError: null })
      })
      .catch((error) => {
        if (
          isTrackerAccountScopeCurrent(scope) &&
          version === revision &&
          activeKey === baseKey
        )
          set({ countsError: getTrackerErrorMessage(error) })
      })
      .finally(() => {
        if (pending.get(key) !== task) return

        pending.delete(key)

        if (
          isTrackerAccountScopeCurrent(scope) &&
          activeKey === baseKey &&
          version !== revision
        )
          return refreshJobCounts(false)
      })

    pending.set(key, task)

    return task
  }

  return {
    refreshJobCounts,
    runJobBatch: async (task: () => Promise<void>) => {
      const scope = getTrackerAccountScope()

      batchDepth++

      try {
        await task()
      } finally {
        if (isTrackerAccountScopeCurrent(scope)) {
          batchDepth--

          if (!batchDepth && dirty) {
            dirty = false
            refreshJobCounts()
          }
        }
      }
    },
    resetCounts: () => {
      batchDepth = 0
      dirty = false
      cache.clear()
      pending.clear()
      history = undefined
      localKey = undefined
      activeKey = undefined
      version++
    },
  }
}
