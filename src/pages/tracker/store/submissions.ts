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
  JobSubmission,
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

function invalidateResource<T>(resource?: SubmissionResource<T>) {
  return {
    data: null,
    loading: false,
    error: null,
    revision: (resource?.revision ?? 0) + 1,
  }
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
    const cached = get()[collection][key]
    const revision = cached?.revision ?? 0

    if (cached?.data || cached?.loading) return

    const write = (
      resource: Omit<SubmissionResource<SubmissionData[K]>, 'revision'>,
    ) => {
      if (!isTrackerAccountScopeCurrent(scope)) return
      if ((get()[collection][key]?.revision ?? 0) !== revision) return

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
    notifySubmissionChanged: (
      record: JobSubmission,
      records?: JobSubmission[],
    ) =>
      set((state) => {
        const previous = state.submissionsByJob[record.job_id]
        const cached = previous?.data

        const rows =
          records ??
          (cached?.kind === 'ready'
            ? [cached.primary, ...cached.legacy]
            : cached?.kind === 'needs-resolution'
              ? cached.legacy
              : [])

        const updated = [record, ...rows.filter((row) => row.id !== record.id)]
        const primary = updated.find((row) => row.is_primary)
        const materialKey = submissionMaterialKey(record.id)

        const data: JobSubmissionState = primary
          ? {
              kind: 'ready',
              primary,
              legacy: updated.filter((row) => !row.is_primary),
            }
          : { kind: 'needs-resolution', legacy: updated }

        return {
          submissionRevision: state.submissionRevision + 1,
          submissionsByJob: {
            ...state.submissionsByJob,
            [record.job_id]: { ...invalidateResource(previous), data },
          },
          submissionJdsById: {
            ...state.submissionJdsById,
            [record.id]: invalidateResource(state.submissionJdsById[record.id]),
          },
          submissionHistoriesById: {
            ...state.submissionHistoriesById,
            [record.id]: invalidateResource(
              state.submissionHistoriesById[record.id],
            ),
          },
          submissionMaterialsByKey: {
            ...state.submissionMaterialsByKey,
            [materialKey]: invalidateResource(
              state.submissionMaterialsByKey[materialKey],
            ),
          },
        }
      }),
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
