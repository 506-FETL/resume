import { companyJobsChanged } from '../../lib/company-reads'
import type { PersistenceRuntime } from './runtime'
import type { WorkflowDrafts } from './workflow-drafts'
import type { FieldWrites } from './field-writes'
import type { Runtime, JobFieldsPatch, WorkflowField } from './types'
import { SubmissionRefreshError } from './errors'
import type { ReopenProcessInput } from '../../types'
import {
  getCompanyProgressById,
  reassignTrackerProcess,
  reopenTrackerProcess,
} from '@/lib/supabase/resume/company'
import type { SubmissionInput } from '../../submission-types'
import {
  recordJobSubmission,
  SubmissionSaveError,
} from '@/lib/supabase/resume/submissions'
import {
  assertTrackerAccountScope,
  createTrackerAccountGuard,
  getTrackerAccountScope,
} from '../../lib/account-scope'
import { normalizeJobWorkflow } from '../../workflow'

export function createSubmissionActions(
  core: PersistenceRuntime,
  drafts: WorkflowDrafts,
  writes: FieldWrites,
) {
  const { find, isLive, merge, enqueue, requestFlush } = core
  const { persistDirty } = drafts
  const { applyTransaction } = writes

  const refreshSubmissionJob = async (
    id: string,
    runtime: Runtime,
    versions = { ...runtime.versions },
  ) => {
    const scope = getTrackerAccountScope()

    const saved = await getCompanyProgressById(
      id,
      createTrackerAccountGuard(scope),
    )

    assertTrackerAccountScope(scope)

    if (!saved || !isLive(id, runtime)) throw new Error('该职位已删除或不可用')

    const accepted: JobFieldsPatch = {}

    for (const field of [
      'status',
      'stage_details',
      'interview_sub_stages',
      'activities',
      'updated_at',
      'has_submission',
      'unresolved_submissions',
    ] as const) {
      runtime.baseline = { ...runtime.baseline, [field]: saved[field] }

      if (
        !runtime.dirty.has(field as WorkflowField) &&
        runtime.versions[field] === versions[field]
      )
        Object.assign(accepted, { [field]: saved[field] })
    }

    const job = find(id)!

    if (saved.status !== job.status)
      companyJobsChanged(job.tracker_company_id, job.status, saved.status)

    merge(id, accepted)

    const latest = normalizeJobWorkflow(find(id)!)

    merge(id, {
      stage_details: latest.stage_details,
      interview_sub_stages: latest.interview_sub_stages,
    })
  }

  return {
    refreshSubmissionJob: (id: string) =>
      enqueue(id, (runtime) => refreshSubmissionJob(id, runtime)),
    reassignCompany: (jobId: string, companyId: string) => {
      const guard = createTrackerAccountGuard(getTrackerAccountScope())

      return applyTransaction(
        jobId,
        ['tracker_company_id', 'company', 'company_logo', 'updated_at'],
        () => reassignTrackerProcess(jobId, companyId, guard),
      )
    },
    reopenProcess: (input: ReopenProcessInput) => {
      const guard = createTrackerAccountGuard(getTrackerAccountScope())

      return applyTransaction(
        input.jobId,
        [
          'status',
          'stage_details',
          'interview_sub_stages',
          'activities',
          'archived',
          'updated_at',
        ],
        () => reopenTrackerProcess(input, guard),
      )
    },
    recordSubmission: (input: SubmissionInput) =>
      enqueue(input.jobId, async (runtime) => {
        const scope = getTrackerAccountScope()

        requestFlush(runtime)

        try {
          await persistDirty(input.jobId, runtime)
        } catch {
          assertTrackerAccountScope(scope)

          throw new SubmissionSaveError(
            '流程内容保存失败，尚未发送投递记录，请重试',
            'rejected',
          )
        }

        const versions = { ...runtime.versions }

        const result = await recordJobSubmission(
          input,
          createTrackerAccountGuard(scope),
        )

        try {
          await refreshSubmissionJob(input.jobId, runtime, versions)
        } catch (cause) {
          assertTrackerAccountScope(scope)

          throw new SubmissionRefreshError(result, cause)
        }

        return result
      }),
  }
}
