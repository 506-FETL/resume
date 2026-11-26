import type { PersistenceRuntime } from './runtime'
import type { WorkflowDrafts } from './workflow-drafts'
import type { JobFieldsPatch, WorkflowField, WorkflowSaveState } from './types'
import type { JobApplication } from '../../types'
import { deleteCompany } from '@/lib/supabase/resume/company/mutations'
import {
  getCompanies,
  getCompanyProgressById,
} from '@/lib/supabase/resume/company/queries'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '../../lib/account-scope'
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
  const details = new Map<string, Promise<void>>()

  return {
    saveStates: {} as Record<string, WorkflowSaveState>,
    resetPersistence: () => {
      runtimes.forEach(clearTimer)
      runtimes.clear()
      deleted.clear()
      generations.clear()
      details.clear()
    },
    ensureJobLoaded: (id: string): Promise<void> => {
      const job = core.find(id)

      if (job && job.workflowLoaded !== false) return Promise.resolve()

      const pending = details.get(id)

      if (pending) return pending

      const scope = getTrackerAccountScope()
      const guard = createTrackerAccountGuard(scope)
      const generation = generations.get(id)

      const read = async (): Promise<void> => {
        if (!core.find(id)) {
          const [full] = await getCompanies(guard, id)

          assertTrackerAccountScope(scope)

          if (!full || deleted.has(id)) throw new Error('该职位已删除或不可用')

          const found = core.find(id)

          if (!found) {
            set((state) => ({ jobs: [full, ...state.jobs] }))

            return
          }
          if (
            found.workflowLoaded === false &&
            found.updated_at === full.updated_at
          ) {
            const runtime = core.runtimeFor(id)

            const patch = {
              stage_details: full.stage_details,
              interview_sub_stages: full.interview_sub_stages,
              activities: full.activities,
              workflowLoaded: true,
            }

            runtime.baseline = { ...runtime.baseline, ...patch }
            core.merge(id, patch)

            return
          }
        }

        const before = core.find(id)!

        if (before.workflowLoaded !== false) return

        const runtime = core.runtimeFor(id)
        const versions = { ...runtime.versions }
        const inFlight = new Set(runtime.inFlight)
        const saved = await getCompanyProgressById(id, guard)

        assertTrackerAccountScope(scope)

        const current = core.find(id)

        if (
          !current ||
          !saved ||
          deleted.has(id) ||
          generations.get(id) !== generation
        )
          throw new Error('该职位已删除或不可用')
        if (current.workflowLoaded !== false) return
        if (current.updated_at !== before.updated_at) return read()

        const full = normalizeJobWorkflow({
          ...current,
          ...saved,
          workflowLoaded: true,
        })

        const patch: JobFieldsPatch = {
          stage_details: full.stage_details,
          interview_sub_stages: full.interview_sub_stages,
          activities: full.activities,
          status: full.status,
          updated_at: full.updated_at,
          has_submission: full.has_submission,
          unresolved_submissions: full.unresolved_submissions,
          workflowLoaded: true,
        }

        for (const field of Object.keys(patch) as (keyof JobFieldsPatch)[]) {
          if (
            runtime.dirty.has(field as WorkflowField) ||
            runtime.inFlight.has(field) ||
            inFlight.has(field) ||
            runtime.versions[field] !== versions[field]
          )
            delete patch[field]
        }

        runtime.baseline = { ...runtime.baseline, ...patch }
        core.merge(id, patch)
      }

      const task = read().finally(() => {
        if (details.get(id) === task) details.delete(id)
      })

      details.set(id, task)

      return task
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
  }
}
