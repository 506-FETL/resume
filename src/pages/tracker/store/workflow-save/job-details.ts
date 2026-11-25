import {
  getCompanyDetailField,
  type JobDetailField,
} from '@/lib/supabase/resume/company/queries'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '../../lib/account-scope'
import type { PersistenceRuntime } from './runtime'
import type { Runtime } from './types'

export function createJobDetails(core: PersistenceRuntime) {
  const requests = new WeakMap<
    Runtime,
    Partial<Record<JobDetailField, { revision: string; task: Promise<void> }>>
  >()

  const loadJobDetail = async (
    id: string,
    field: JobDetailField,
  ): Promise<void> => {
    const runtime = core.runtimeFor(id)
    const job = core.find(id)!

    if (job[field] !== undefined) return

    const pending = requests.get(runtime) ?? {}
    const previous = pending[field]

    if (previous?.revision === job.updated_at) return previous.task

    const guard = createTrackerAccountGuard(getTrackerAccountScope())

    const task = getCompanyDetailField(id, field, guard).then((patch) => {
      if (!core.isLive(id, runtime)) throw new Error('该职位已删除或不可用')

      const latest = core.find(id)!

      if (latest[field] !== undefined) return
      if (latest.updated_at !== job.updated_at) return loadJobDetail(id, field)

      runtime.baseline = { ...runtime.baseline, ...patch }
      core.merge(id, patch)
    })

    pending[field] = { revision: job.updated_at, task }
    requests.set(runtime, pending)

    try {
      await task
    } finally {
      if (pending[field]?.task === task) delete pending[field]
    }
  }

  return { loadJobDetail }
}
