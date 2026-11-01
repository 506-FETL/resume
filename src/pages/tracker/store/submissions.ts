import {
  getJobSubmissionJd,
  getJobSubmissionMaterial,
  getJobSubmissionState,
  listJobSubmissionRevisions,
} from '@/lib/supabase/resume/submissions'
import {
  createTrackerAccountGuard,
  getTrackerAccountScope,
  isTrackerAccountScopeCurrent,
} from '../lib/account-scope'
import type {
  JobSubmissionMaterial,
  JobSubmissionState,
  SubmissionRevision,
} from '../submission-types'
import { getTrackerErrorMessage } from '../utils'

export interface SubmissionResource<T = JobSubmissionState> {
  data: T | null
  loading: boolean
  error: string | null
  revision: number
}

interface SubmissionData {
  submissionsByJob: JobSubmissionState
  submissionJdsById: Awaited<ReturnType<typeof getJobSubmissionJd>>
  submissionHistoriesById: SubmissionRevision[]
  submissionMaterialsByKey: JobSubmissionMaterial
}

type SubmissionResources = {
  [K in keyof SubmissionData]: Record<
    string,
    SubmissionResource<SubmissionData[K]>
  >
} & { submissionRevision: number }

export function submissionMaterialKey(recordId: string, revisionId?: string) {
  return `${recordId}:${revisionId ?? 'current'}`
}

export function createTrackerSubmissions(
  get: () => SubmissionResources,
  set: (
    update:
      | Partial<SubmissionResources>
      | ((state: SubmissionResources) => Partial<SubmissionResources>),
  ) => void,
) {
  const loadResource = async <K extends keyof SubmissionData>(
    collection: K,
    key: string,
    load: (
      guard: ReturnType<typeof createTrackerAccountGuard>,
    ) => Promise<SubmissionData[K]>,
  ) => {
    const scope = getTrackerAccountScope()
    const revision = get().submissionRevision
    const cached = get()[collection][key]

    if (cached?.revision === revision && (cached.data || cached.loading)) return

    const write = (
      resource: Omit<SubmissionResource<SubmissionData[K]>, 'revision'>,
    ) => {
      if (!isTrackerAccountScopeCurrent(scope)) return
      if (get().submissionRevision !== revision) return

      set(
        (state) =>
          ({
            [collection]: {
              ...state[collection],
              [key]: { ...resource, revision },
            },
          }) as Partial<SubmissionResources>,
      )
    }

    write({ data: null, loading: true, error: null })

    try {
      const data = await load(createTrackerAccountGuard(scope))

      write({ data, loading: false, error: null })
    } catch (cause) {
      write({
        data: null,
        loading: false,
        error: getTrackerErrorMessage(cause),
      })
    }
  }

  return {
    submissionsByJob: {} as SubmissionResources['submissionsByJob'],
    submissionJdsById: {} as SubmissionResources['submissionJdsById'],
    submissionHistoriesById:
      {} as SubmissionResources['submissionHistoriesById'],
    submissionMaterialsByKey:
      {} as SubmissionResources['submissionMaterialsByKey'],
    notifySubmissionChanged: () =>
      set((state) => ({ submissionRevision: state.submissionRevision + 1 })),
    loadSubmissionJd: (recordId: string) =>
      loadResource('submissionJdsById', recordId, (guard) =>
        getJobSubmissionJd(recordId, guard),
      ),
    loadSubmissions: (jobId: string) =>
      loadResource('submissionsByJob', jobId, (guard) =>
        getJobSubmissionState(jobId, guard),
      ),
    loadSubmissionHistory: (recordId: string) =>
      loadResource('submissionHistoriesById', recordId, (guard) =>
        listJobSubmissionRevisions(recordId, guard),
      ),
    loadSubmissionMaterial: (recordId: string, revisionId?: string) =>
      loadResource(
        'submissionMaterialsByKey',
        submissionMaterialKey(recordId, revisionId),
        (guard) => getJobSubmissionMaterial(recordId, guard, revisionId),
      ),
  }
}
