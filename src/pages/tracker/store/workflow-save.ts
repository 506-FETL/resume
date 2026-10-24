import type {
  ApplicationStatus,
  InterviewSubStage,
  JobApplication,
  StageDetail,
} from '../types'
import {
  deleteCompany,
  getCompanies,
  updateCompany,
} from '@/lib/supabase/resume'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import { appendStatusChangeActivity, getTrackerErrorMessage } from '../utils'
import {
  normalizeInterviewSubStages,
  normalizeJobWorkflow,
  transitionJobWorkflow,
} from '../workflow'

export type WorkflowSaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'

export interface WorkflowSaveState {
  status: WorkflowSaveStatus
  error: string | null
}

export type JobFieldsPatch = Partial<
  Omit<JobApplication, 'id' | 'created_at' | 'user_id'>
>

type JobPatchFactory = (job: JobApplication) => JobFieldsPatch

type WorkflowField = 'stage_details' | 'interview_sub_stages'

// 与简历编辑的在线保存保持一致；草稿立即更新，网络写入等待输入空闲。
const WORKFLOW_SAVE_DELAY = 3000

const sameValue = (left: unknown, right: unknown) =>
  Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)

interface PersistenceState {
  jobs: JobApplication[]
  selectedJob: JobApplication | null
  saveStates: Record<string, WorkflowSaveState>
  loading: boolean
  error: string | null
  isInitialized: boolean
  removeJobs: (ids: Iterable<string>) => void
}

interface Runtime {
  tail: Promise<unknown>
  timer: ReturnType<typeof setTimeout> | null
  saveAfter: number
  flushVersions: Partial<Record<WorkflowField, number>>
  flushTask: Promise<void> | null
  versions: Partial<Record<keyof JobApplication, number>>
  baseline: JobApplication
  inFlight: Set<keyof JobApplication>
  dirty: Set<WorkflowField>
  deleting: boolean
}

// 页面级队列不依赖 Drawer 挂载。整行 API 响应只接纳本次提交的字段。
export function createTrackerPersistence(
  get: () => PersistenceState,
  set: (
    update:
      | Partial<PersistenceState>
      | ((state: PersistenceState) => Partial<PersistenceState>),
  ) => void,
) {
  const runtimes = new Map<string, Runtime>()
  const deleted = new Set<string>()
  const generations = new Map<string, number>()
  let reloadPromise: Promise<void> | null = null

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

  const merge = (id: string, patch: JobFieldsPatch) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...patch } : job,
      ),
      selectedJob:
        state.selectedJob?.id === id
          ? { ...state.selectedJob, ...patch }
          : state.selectedJob,
    }))

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

  const persistDirty = async (id: string, runtime: Runtime) => {
    if (!runtime.dirty.size) return

    while (runtime.dirty.size && isLive(id, runtime)) {
      // 主动刷新只加速当前批次。请求期间的新输入仍遵守自己的防抖截止时间。
      const requested = [...runtime.dirty].some(
        (field) =>
          runtime.flushVersions[field] !== undefined &&
          runtime.flushVersions[field] === runtime.versions[field],
      )

      if (!requested && Date.now() < runtime.saveAfter) break

      runtime.flushVersions = {}
      clearTimer(runtime)

      const job = find(id)!

      for (const field of runtime.dirty) {
        if (sameValue(job[field], runtime.baseline[field]))
          runtime.dirty.delete(field)
      }

      if (!runtime.dirty.size) break

      const fields = [...runtime.dirty]
      const versions = fields.map((field) => runtime.versions[field])

      const patch: JobFieldsPatch = Object.fromEntries(
        fields.map((field) => [field, job[field]]),
      )

      saveState(id, runtime, 'saving')
      fields.forEach((field) => runtime.inFlight.add(field))

      try {
        const saved = await updateCompany(
          id,
          patch,
          createTrackerAccountGuard(getTrackerAccountScope()),
        )

        if (!isLive(id, runtime)) return

        const accepted: JobFieldsPatch = { updated_at: saved.updated_at }

        fields.forEach((field, index) => {
          runtime.baseline = { ...runtime.baseline, [field]: saved[field] }

          if (runtime.versions[field] === versions[index]) {
            Object.assign(accepted, { [field]: saved[field] })
            runtime.dirty.delete(field)
          }
        })

        bump(runtime, 'updated_at')
        merge(id, accepted)
      } catch (error) {
        clearTimer(runtime)
        runtime.flushVersions = {}
        saveState(id, runtime, 'error', getTrackerErrorMessage(error))

        throw error
      } finally {
        fields.forEach((field) => runtime.inFlight.delete(field))
      }
    }

    if (!isLive(id, runtime)) return
    if (runtime.dirty.size) {
      armTimer(id, runtime)
      saveState(id, runtime, 'pending')
    } else {
      clearTimer(runtime)
      runtime.flushVersions = {}
      saveState(id, runtime, 'saved')
    }
  }

  const queueWorkflowSave = (id: string, immediate: boolean) => {
    const runtime = runtimes.get(id)

    if (!runtime || runtime.deleting || !isLive(id, runtime))
      return Promise.resolve()
    if (!runtime.dirty.size) return runtime.flushTask ?? Promise.resolve()
    if (immediate) {
      clearTimer(runtime)
      requestFlush(runtime)
    }
    // 失焦、切换和关闭可以在同一轮触发，共享在途任务，避免重复排队或失败后自动重试。
    if (!runtime.flushTask) {
      const task = enqueue(id, (current) => persistDirty(id, current))

      runtime.flushTask = task.finally(() => {
        runtime.flushTask = null
      })
    }

    return runtime.flushTask
  }

  const flushWorkflow = (id: string) => queueWorkflowSave(id, true)

  function armTimer(id: string, runtime: Runtime) {
    clearTimer(runtime)

    runtime.timer = setTimeout(
      () => {
        runtime.timer = null
        queueWorkflowSave(id, false).catch(() => {})
      },
      Math.max(0, runtime.saveAfter - Date.now()),
    )
  }

  const schedule = (id: string, runtime: Runtime, immediate: boolean) => {
    runtime.saveAfter = Date.now() + WORKFLOW_SAVE_DELAY
    saveState(id, runtime, 'pending')

    if (immediate) flushWorkflow(id).catch(() => {})
    else armTimer(id, runtime)
  }

  const editWorkflow = (
    id: string,
    field: WorkflowField,
    value: StageDetail[] | InterviewSubStage[],
    immediate: boolean,
  ) => {
    const runtime = runtimeFor(id)

    if (runtime.deleting || sameValue(find(id)?.[field], value)) return

    bump(runtime, field)
    merge(id, { [field]: value })

    // 撤回到已保存内容时取消无效写入；在途请求可能改变基线，必须保留纠正写入。
    if (
      !runtime.inFlight.has(field) &&
      sameValue(runtime.baseline[field], value)
    )
      runtime.dirty.delete(field)
    else runtime.dirty.add(field)
    if (!runtime.dirty.size) {
      clearTimer(runtime)
      runtime.flushVersions = {}
      saveState(id, runtime, 'saved')

      return
    }

    schedule(id, runtime, immediate)
  }

  const writePatch = async (
    id: string,
    runtime: Runtime,
    patch: JobFieldsPatch,
  ) => {
    if ('id' in patch || 'created_at' in patch || 'user_id' in patch)
      throw new Error('不能修改职位标识或归属信息')

    const current = find(id)!

    patch = Object.fromEntries(
      Object.entries(patch).filter(
        ([field, value]) =>
          !sameValue(current[field as keyof JobApplication], value) ||
          (runtime.dirty.has(field as WorkflowField) &&
            !sameValue(runtime.baseline[field as keyof JobApplication], value)),
      ),
    )

    const fields = Object.keys(patch) as (keyof JobFieldsPatch)[]

    if (!fields.length) return current

    const versions = fields.map((field) => bump(runtime, field))

    merge(id, patch)
    fields.forEach((field) => runtime.inFlight.add(field))

    try {
      const saved = await updateCompany(
        id,
        patch,
        createTrackerAccountGuard(getTrackerAccountScope()),
      )

      if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

      const accepted: JobFieldsPatch = { updated_at: saved.updated_at }

      fields.forEach((field, index) => {
        runtime.baseline = { ...runtime.baseline, [field]: saved[field] }

        if (runtime.versions[field] === versions[index])
          Object.assign(accepted, { [field]: saved[field] })
      })

      bump(runtime, 'updated_at')
      merge(id, accepted)

      return find(id)!
    } catch (error) {
      if (isLive(id, runtime)) {
        const rollback: JobFieldsPatch = {}

        fields.forEach((field, index) => {
          if (runtime.versions[field] === versions[index])
            Object.assign(rollback, { [field]: runtime.baseline[field] })
        })

        // 状态请求中的新输入仍保留，但状态恢复后要重新计算轮次状态。
        const current = find(id)!

        if ('status' in patch) {
          if (
            runtime.versions.stage_details !==
            versions[fields.indexOf('stage_details')]
          ) {
            // 首次进入已结束时条目可能只存在于乐观请求中；保留随后输入的内容，
            // 以弱态空条目作为回滚基线，移除失败转换创造的来源和历史标记。
            const newContentStages = current.stage_details
              .filter((detail) => {
                if (
                  runtime.baseline.stage_details.some(
                    (base) => base.stage === detail.stage,
                  )
                )
                  return false

                const submitted = patch.stage_details?.find(
                  (item) => item.stage === detail.stage,
                )

                return (
                  detail.notes !== (submitted?.notes ?? '') ||
                  detail.start_date !== (submitted?.start_date ?? null)
                )
              })
              .map((detail) => ({
                stage: detail.stage,
                status: '待处理' as const,
                start_date: null,
                notes: '',
              }))

            rollback.stage_details = [
              ...runtime.baseline.stage_details,
              ...newContentStages,
            ].map((detail) => {
              const draft = current.stage_details.find(
                (item) => item.stage === detail.stage,
              )

              const submitted = patch.stage_details?.find(
                (item) => item.stage === detail.stage,
              )

              return {
                ...detail,
                ...(draft && draft.notes !== submitted?.notes
                  ? { notes: draft.notes }
                  : {}),
                ...(draft && draft.start_date !== submitted?.start_date
                  ? { start_date: draft.start_date }
                  : {}),
              }
            })
          }
          if (
            runtime.versions.interview_sub_stages !==
            versions[fields.indexOf('interview_sub_stages')]
          ) {
            rollback.interview_sub_stages = current.interview_sub_stages.map(
              (round) => {
                const base = runtime.baseline.interview_sub_stages.find(
                  (item) => item.id === round.id,
                )

                const submitted = patch.interview_sub_stages?.find(
                  (item) => item.id === round.id,
                )

                if (!base) return round

                return {
                  ...base,
                  ...(round.label !== submitted?.label
                    ? { label: round.label }
                    : {}),
                  ...(round.notes !== submitted?.notes
                    ? { notes: round.notes }
                    : {}),
                  ...(round.start_date !== submitted?.start_date
                    ? { start_date: round.start_date }
                    : {}),
                }
              },
            )
          }
        }

        const normalized = normalizeJobWorkflow({ ...current, ...rollback })

        merge(id, {
          ...rollback,
          stage_details: normalized.stage_details,
          interview_sub_stages: normalized.interview_sub_stages,
        })
      }

      throw error
    } finally {
      fields.forEach((field) => runtime.inFlight.delete(field))
    }
  }

  return {
    saveStates: {} as Record<string, WorkflowSaveState>,
    resetPersistence: () => {
      runtimes.forEach(clearTimer)
      runtimes.clear()
      deleted.clear()
      generations.clear()
      reloadPromise = null
    },
    saveJobFields: (id: string, patch: JobFieldsPatch | JobPatchFactory) =>
      enqueue(id, (runtime) => {
        const changes = typeof patch === 'function' ? patch(find(id)!) : patch

        if (
          'status' in changes ||
          'stage_details' in changes ||
          'interview_sub_stages' in changes
        )
          throw new Error('流程状态和内容必须使用流程保存动作')

        return writePatch(id, runtime, changes)
      }),
    flushWorkflow,
    retryWorkflow: flushWorkflow,
    hasPendingWorkflow: () =>
      [...runtimes].some(
        ([id, runtime]) =>
          isLive(id, runtime) &&
          !runtime.deleting &&
          (runtime.dirty.size > 0 ||
            runtime.inFlight.has('stage_details') ||
            runtime.inFlight.has('interview_sub_stages')),
      ),
    flushPendingWorkflows: () =>
      Promise.allSettled([...runtimes.keys()].map(flushWorkflow)),
    changeJobStatus: (
      id: string,
      target: ApplicationStatus,
      fields: JobFieldsPatch = {},
    ) =>
      enqueue(id, async (runtime) => {
        if (
          'status' in fields ||
          'stage_details' in fields ||
          'interview_sub_stages' in fields ||
          'activities' in fields
        )
          throw new Error('附加字段不能覆盖流程状态、内容或活动')

        // 在同一串行任务内刷新，不能 enqueue 后再 await 自己后面的队列。
        requestFlush(runtime)
        await persistDirty(id, runtime)
        runtime.flushVersions = {}

        if (!isLive(id, runtime)) throw new Error('该职位已删除或不可用')

        const job = find(id)!

        if (job.status === target) {
          if (Object.keys(fields).length) await writePatch(id, runtime, fields)

          return
        }

        const transitioned = transitionJobWorkflow(job, target)

        await writePatch(id, runtime, {
          ...fields,
          status: transitioned.status,
          stage_details: transitioned.stage_details,
          interview_sub_stages: transitioned.interview_sub_stages,
          activities: appendStatusChangeActivity(job, target),
        })

        // 请求期间可能继续编辑内容；以成功状态规范化最新草稿。
        if (isLive(id, runtime)) {
          const latest = normalizeJobWorkflow(find(id)!)

          merge(id, {
            stage_details: latest.stage_details,
            interview_sub_stages: latest.interview_sub_stages,
          })

          await persistDirty(id, runtime)
        }
      }),
    editStageContent: (
      id: string,
      stage: ApplicationStatus,
      patch: Partial<Pick<StageDetail, 'start_date' | 'notes'>>,
      immediate = false,
    ) => {
      const job = find(id)

      if (!job) return

      const details = normalizeJobWorkflow(job).stage_details
      // 展开保存整个条目，保留终态 source_stage 的 undefined / null 语义。
      const content: Partial<Pick<StageDetail, 'start_date' | 'notes'>> = {}

      if ('notes' in patch) content.notes = patch.notes
      if ('start_date' in patch) content.start_date = patch.start_date
      if (!Object.keys(content).length) return

      const updated = details.some((detail) => detail.stage === stage)
        ? details.map((detail) =>
            detail.stage === stage ? { ...detail, ...content } : detail,
          )
        : [
            ...details,
            {
              stage,
              status: '待处理' as const,
              start_date: null,
              notes: '',
              ...content,
            },
          ]

      // 内容编辑可补建旧记录缺失的条目，不创建来源、推进活动或历史状态。
      const next = normalizeJobWorkflow({
        ...job,
        stage_details: updated,
      }).stage_details

      editWorkflow(
        id,
        'stage_details',
        next,
        immediate || 'start_date' in patch,
      )
    },
    editInterviewRound: (
      id: string,
      roundId: string,
      patch: Partial<Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>>,
      immediate = false,
    ) => {
      const job = find(id)

      if (
        !job ||
        !job.interview_sub_stages.some((round) => round.id === roundId)
      )
        return

      const content: Partial<
        Pick<InterviewSubStage, 'label' | 'start_date' | 'notes'>
      > = {}

      if ('label' in patch) content.label = patch.label
      if ('notes' in patch) content.notes = patch.notes
      if ('start_date' in patch) content.start_date = patch.start_date
      if (!Object.keys(content).length) return

      const next = job.interview_sub_stages.map((round) =>
        round.id === roundId ? { ...round, ...content } : round,
      )

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        immediate || 'start_date' in patch,
      )
    },
    addInterviewRound: (id: string): string | null => {
      const job = find(id)

      if (!job || job.status !== 'interview' || runtimeFor(id).deleting)
        return null

      const roundId = crypto.randomUUID()

      const order =
        Math.max(-1, ...job.interview_sub_stages.map((round) => round.order)) +
        1

      const next = [
        ...job.interview_sub_stages,
        {
          id: roundId,
          label: `第 ${job.interview_sub_stages.length + 1} 轮面试`,
          status: '进行中' as const,
          start_date: null,
          notes: '',
          order,
        },
      ]

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        true,
      )

      return roundId
    },
    removeInterviewRound: (id: string, roundId: string) => {
      const job = find(id)

      if (!job) return

      const next = job.interview_sub_stages.filter(
        (round) => round.id !== roundId,
      )

      editWorkflow(
        id,
        'interview_sub_stages',
        normalizeInterviewSubStages(job.status, next),
        true,
      )
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

          const jobs = loaded
            .filter(
              (job) => job.user_id === scope.userId && !deleted.has(job.id),
            )
            .map((row) => {
              const runtime = runtimes.get(row.id)
              const current = find(row.id)

              if (
                current &&
                (generations.get(row.id) ?? 0) !==
                  (generationSnapshot.get(row.id) ?? 0)
              )
                return current
              if (!runtime || !current) return row

              const before = snapshot.get(row.id)
              const merged = { ...row }

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
                else
                  runtime.baseline = {
                    ...runtime.baseline,
                    [field]: row[field],
                  }
              }

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
