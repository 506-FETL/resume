import type { PersistenceRuntime } from './runtime'
import type { WorkflowDrafts } from './workflow-drafts'
import type { WorkflowSaveState, WorkflowField } from './types'
import type { JobApplication } from '../../types'
import { deleteCompany, getCompanies } from '@/lib/supabase/resume'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../../lib/account-scope'
import { getTrackerErrorMessage } from '../../utils'
import { normalizeJobWorkflow } from '../../workflow'

export function createJobLifecycle(
  core: PersistenceRuntime,
  drafts: WorkflowDrafts,
) {
  const {
    get,
    set,
    runtimes,
    deleted,
    generations,
    runtimeFor,
    clearTimer,
    enqueue,
    isLive,
  } = core

  const { schedule } = drafts
  let reloadPromise: Promise<void> | null = null

  return {
    saveStates: {} as Record<string, WorkflowSaveState>,
    resetPersistence: () => {
      runtimes.forEach(clearTimer)
      runtimes.clear()
      deleted.clear()
      generations.clear()
      reloadPromise = null
    },
    ensureJobLoaded: async (id: string) => {
      if (core.find(id)) return

      const scope = getTrackerAccountScope()
      const [job] = await getCompanies(createTrackerAccountGuard(scope), id)

      assertTrackerAccountScope(scope)

      if (core.find(id)) return
      if (!job || deleted.has(id)) throw new Error('该职位已删除或不可用')

      set((state) => ({ jobs: [job, ...state.jobs] }))
    },
    deleteJob: (id: string) => {
      const runtime = runtimeFor(id)

      clearTimer(runtime)

      const task = enqueue(id, async () => {
        await deleteCompany(
          id,
          createTrackerAccountGuard(getTrackerAccountScope()),
        )

        if (isLive(id, runtime)) get().removeJobs([id])
      })

      runtime.deleting = true

      return task.finally(() => {
        runtime.deleting = false

        if (isLive(id, runtime) && runtime.dirty.size)
          schedule(id, runtime, true)
      })
    },
    invalidateJobs: (ids: Iterable<string>) => {
      for (const id of ids) {
        const runtime = runtimes.get(id)

        if (runtime) clearTimer(runtime)

        runtimes.delete(id)
        deleted.add(id)
        generations.set(id, (generations.get(id) ?? 0) + 1)
      }
    },
    acceptNewJob: (job: JobApplication) => {
      deleted.delete(job.id)
      generations.set(job.id, (generations.get(job.id) ?? 0) + 1)
      runtimes.delete(job.id)

      return normalizeJobWorkflow(job)
    },
    reloadJobs: (): Promise<void> => {
      const scope = getTrackerAccountScope()

      if (!scope.userId) return Promise.resolve()
      if (reloadPromise) return reloadPromise

      const task = (async () => {
        // 全字段版本快照避免重载中的联系人/流程/简历写入被旧查询结果覆盖。
        const snapshot = new Map(
          [...runtimes].map(([id, runtime]) => [
            id,
            {
              runtime,
              versions: { ...runtime.versions },
              inFlight: new Set(runtime.inFlight),
            },
          ]),
        )

        const generationSnapshot = new Map(generations)
        const previousIds = new Set(get().jobs.map((job) => job.id))

        set({ loading: true, error: null })

        try {
          const loaded = await getCompanies(createTrackerAccountGuard(scope))

          if (!isTrackerAccountScopeCurrent(scope)) return

          const currentJobs = new Map(get().jobs.map((job) => [job.id, job]))

          const jobs = loaded
            .filter(
              (job) => job.user_id === scope.userId && !deleted.has(job.id),
            )
            .map((row) => {
              const runtime = runtimes.get(row.id)
              const current = currentJobs.get(row.id)

              if (
                current &&
                (generations.get(row.id) ?? 0) !==
                  (generationSnapshot.get(row.id) ?? 0)
              )
                return current
              if (current?.updated_at === row.updated_at) {
                for (const field of [
                  'contacts',
                  'jd_text',
                  'jd_updated_at',
                  'source',
                ] as const) {
                  if (current[field] !== undefined)
                    Object.assign(row, { [field]: current[field] })
                }
              }
              if (!runtime || !current) return row

              const before = snapshot.get(row.id)
              const merged = { ...row }
              const baseline = { ...runtime.baseline }

              for (const field of Object.keys(
                current,
              ) as (keyof JobApplication)[]) {
                if (
                  runtime.dirty.has(field as WorkflowField) ||
                  runtime.inFlight.has(field) ||
                  before?.inFlight.has(field) ||
                  (runtime.versions[field] ?? 0) !==
                    (before?.versions[field] ?? 0) ||
                  (before && runtime !== before.runtime)
                )
                  Object.assign(merged, { [field]: current[field] })
                else Object.assign(baseline, { [field]: row[field] })
              }

              runtime.baseline = baseline

              return merged
            })

          // 查询开始后刚创建的职位不能被旧列表删掉。
          const loadedIds = new Set(jobs.map((job) => job.id))

          jobs.unshift(
            ...get().jobs.filter(
              (job) =>
                !previousIds.has(job.id) &&
                !loadedIds.has(job.id) &&
                !deleted.has(job.id),
            ),
          )

          set((state) => ({
            jobs,
            selectedJob: state.selectedJob
              ? (jobs.find((job) => job.id === state.selectedJob?.id) ?? null)
              : null,
            loading: false,
            error: null,
            isInitialized: true,
          }))
        } catch (error) {
          if (!isTrackerAccountScopeCurrent(scope)) return

          set({ loading: false, error: getTrackerErrorMessage(error) })

          throw error
        }
      })()

      const pending = task.finally(() => {
        if (reloadPromise === pending) reloadPromise = null
      })

      reloadPromise = pending

      return reloadPromise
    },
  }
}
