import type { JobApplication } from '../../types'
import type { PersistenceRuntime } from './runtime'
import type { WorkflowField } from './types'

const workflowFields = [
  'stage_details',
  'interview_sub_stages',
  'activities',
  'workflowLoaded',
] as const

const revisionFields = [
  'source',
  'jd_text',
  'jd_updated_at',
  'contacts',
  ...workflowFields,
] as const

/** 摘要可以刷新卡片。已读取的正文只在版本相同时复用，进行中的字段写入由原队列处理。 */
export function createPageMerge(
  core: PersistenceRuntime,
  owner: string | null,
) {
  const before = new Map(core.get().jobs.map((job) => [job.id, job]))
  const generations = new Map(core.generations)

  const versions = new Map(
    [...core.runtimes].map(([id, runtime]) => [
      id,
      {
        versions: { ...runtime.versions },
        inFlight: new Set(runtime.inFlight),
      },
    ]),
  )

  return (batch: JobApplication[], archived: boolean, ids: Set<string>) => {
    const current = new Map(core.get().jobs.map((job) => [job.id, job]))
    const result = new Set(ids)

    for (const row of batch) {
      if (row.user_id !== owner || core.deleted.has(row.id)) continue

      const job = current.get(row.id)
      const old = before.get(row.id)
      let next = row

      if (job) {
        if (
          core.generations.get(row.id) !== generations.get(row.id) ||
          (old && old.updated_at !== job.updated_at)
        )
          next = job
        else {
          const runtime = core.runtimes.get(row.id)
          const start = versions.get(row.id)

          next = { ...row }

          if (job.updated_at === row.updated_at) {
            for (const field of revisionFields)
              Object.assign(next, { [field]: job[field] })
          }
          if (runtime) {
            const baseline = { ...runtime.baseline }

            for (const field of Object.keys(next) as (keyof JobApplication)[]) {
              if (
                runtime.dirty.has(field as WorkflowField) ||
                runtime.inFlight.has(field) ||
                start?.inFlight.has(field) ||
                (runtime.versions[field] ?? 0) !== (start?.versions[field] ?? 0)
              )
                Object.assign(next, { [field]: job[field] })
              else Object.assign(baseline, { [field]: next[field] })
            }

            runtime.baseline = baseline
          }
        }
      }
      if (next.archived === archived) result.add(next.id)

      current.set(row.id, next)
    }

    core.set((state) => ({
      jobs: [...current.values()],
      selectedJob: state.selectedJob
        ? (current.get(state.selectedJob.id) ?? state.selectedJob)
        : null,
    }))

    return result
  }
}
