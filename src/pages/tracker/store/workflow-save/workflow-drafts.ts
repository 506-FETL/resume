import type { PersistenceRuntime } from './runtime'
import type { Runtime, JobFieldsPatch, WorkflowField } from './types'
import { WORKFLOW_SAVE_DELAY, sameValue } from './values'
import type { InterviewSubStage, StageDetail } from '../../types'
import { updateCompany } from '@/lib/supabase/resume'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '../../lib/account-scope'
import { getTrackerErrorMessage } from '../../utils'

export function createWorkflowDrafts(core: PersistenceRuntime) {
  const {
    runtimes,
    find,
    runtimeFor,
    isLive,
    merge,
    saveState,
    clearTimer,
    bump,
    requestFlush,
    enqueue,
  } = core

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

  return { persistDirty, flushWorkflow, schedule, editWorkflow }
}

export type WorkflowDrafts = ReturnType<typeof createWorkflowDrafts>
