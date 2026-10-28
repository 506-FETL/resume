import { getJobSubmissionState } from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import type { JobSubmissionState } from '../submission-types'
import { getTrackerErrorMessage } from '../utils'

export interface SubmissionResource {
  data: JobSubmissionState | null
  loading: boolean
  error: string | null
}

interface SubmissionResources {
  submissionsByJob: Record<string, SubmissionResource>
  submissionRevision: number
}

export function createTrackerSubmissions(
  set: (
    update:
      | Partial<SubmissionResources>
      | ((state: SubmissionResources) => Partial<SubmissionResources>),
  ) => void,
) {
  const write = (id: string, resource: SubmissionResource) =>
    set((state) => ({
      submissionsByJob: { ...state.submissionsByJob, [id]: resource },
    }))

  return {
    submissionsByJob: {} as Record<string, SubmissionResource>,
    notifySubmissionChanged: () =>
      set((state) => ({ submissionRevision: state.submissionRevision + 1 })),
    loadSubmissions: async (jobId: string) => {
      const scope = getTrackerAccountScope()

      write(jobId, { data: null, loading: true, error: null })

      try {
        const data = await getJobSubmissionState(
          jobId,
          createTrackerAccountGuard(scope),
        )

        if (isTrackerAccountScopeCurrent(scope))
          write(jobId, { data, loading: false, error: null })
      } catch (cause) {
        if (isTrackerAccountScopeCurrent(scope))
          write(jobId, {
            data: null,
            loading: false,
            error: getTrackerErrorMessage(cause),
          })
      }
    },
  }
}
