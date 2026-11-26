import type {
  PersistenceGet,
  PersistenceSet,
  Runtime,
  JobFieldsPatch,
  WorkflowSaveStatus,
} from './types'
import { isJobPendingFollowUp } from '../../utils/follow-up'
import type { JobApplication } from '../../types'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
} from '../../lib/account-scope'

export function createPersistenceRuntime(
  get: PersistenceGet,
  set: PersistenceSet,
) {
  const runtimes = new Map<string, Runtime>()
  const deleted = new Set<string>()
  const generations = new Map<string, number>()

  const find = (id: string) =>
    get().jobs.find(
      (job) => job.id === id && job.user_id === getTrackerAccountScope().userId,
    )

  const runtimeFor = (id: string) => {
    const job = find(id)

    if (!job || deleted.has(id)) throw new Error('该职位已删除或不可用')

    let runtime = runtimes.get(id)

    if (!runtime) {
      runtime = {
        tail: Promise.resolve(),
        timer: null,
        saveAfter: 0,
        flushVersions: {},
        flushTask: null,
        versions: {},
        baseline: job,
        dirty: new Set(),
        inFlight: new Set(),
        deleting: false,
      }

      runtimes.set(id, runtime)
    }

    return runtime
  }

  const isLive = (id: string, runtime: Runtime) =>
    runtimes.get(id) === runtime && !deleted.has(id) && Boolean(find(id))

  const merge = (id: string, patch: JobFieldsPatch) => {
    const current = find(id)
    const stale: JobFieldsPatch = {}

    // 窄写可能接在另一标签页的修改之后，新版本不能继承这次未确认的详情。
    if (
      patch.updated_at &&
      current &&
      patch.updated_at !== current.updated_at
    ) {
      if (!('contacts' in patch)) stale.contacts = undefined
      if (!('jd_text' in patch)) {
        stale.jd_text = undefined
        stale.jd_updated_at = undefined

        if (!('source' in patch)) stale.source = undefined
      }

      const runtime = runtimes.get(id)

      if (runtime) runtime.baseline = { ...runtime.baseline, ...stale }
    }

    const next = { ...stale, ...patch }

    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...next } : job,
      ),
      selectedJob:
        state.selectedJob?.id === id
          ? { ...state.selectedJob, ...next }
          : state.selectedJob,
    }))

    if (!current || 'workflowLoaded' in patch) return

    const merged = { ...current, ...patch }

    const pendingChanged =
      isJobPendingFollowUp(current) !== isJobPendingFollowUp(merged)

    const filterFields = [
      'archived',
      'focused_at',
      'tracker_company_id',
      'company',
      'position',
      'salary',
      'location',
      'status',
      'next_action_date',
    ] as const

    if (
      pendingChanged ||
      filterFields.some(
        (field) => field in patch && current[field] !== merged[field],
      )
    )
      get().rememberJob(merged)
    if (
      patch.updated_at &&
      (pendingChanged ||
        filterFields.some((field) => field in patch) ||
        'has_submission' in patch ||
        'unresolved_submissions' in patch ||
        (merged.has_submission &&
          ('activities' in patch || 'stage_details' in patch)))
    )
      get().refreshJobCounts()
  }

  const saveState = (
    id: string,
    runtime: Runtime,
    status: WorkflowSaveStatus,
    error: string | null = null,
  ) => {
    const previous = get().saveStates[id]

    if (
      isLive(id, runtime) &&
      (previous?.status !== status || previous?.error !== error)
    )
      set((state) => ({
        saveStates: { ...state.saveStates, [id]: { status, error } },
      }))
  }

  const clearTimer = (runtime: Runtime) => {
    if (runtime.timer !== null) clearTimeout(runtime.timer)

    runtime.timer = null
  }

  const bump = (runtime: Runtime, field: keyof JobApplication) => {
    runtime.versions[field] = (runtime.versions[field] ?? 0) + 1

    return runtime.versions[field]!
  }

  const requestFlush = (runtime: Runtime) => {
    runtime.flushVersions = Object.fromEntries(
      [...runtime.dirty].map((field) => [field, runtime.versions[field]]),
    )
  }

  const enqueue = <T>(
    id: string,
    operation: (runtime: Runtime) => Promise<T>,
  ): Promise<T> => {
    const scope = getTrackerAccountScope()
    let runtime: Runtime

    try {
      assertTrackerAccountScope(scope)
      runtime = runtimeFor(id)
    } catch (error) {
      return Promise.reject(error)
    }

    if (runtime.deleting) return Promise.reject(new Error('该职位正在删除'))

    const task = runtime.tail
      .catch(() => {})
      .then(async () => {
        assertTrackerAccountScope(scope)

        if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

        try {
          const result = await operation(runtime)

          assertTrackerAccountScope(scope)

          return result
        } catch (error) {
          // 已发出的旧请求可以结束，但不得触发新会话的成功/失败回调。
          assertTrackerAccountScope(scope)

          throw error
        }
      })

    runtime.tail = task

    return task
  }

  return {
    get,
    set,
    runtimes,
    deleted,
    generations,
    find,
    runtimeFor,
    isLive,
    merge,
    saveState,
    clearTimer,
    bump,
    requestFlush,
    enqueue,
  }
}

export type PersistenceRuntime = ReturnType<typeof createPersistenceRuntime>
