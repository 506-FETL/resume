import type { JobApplication } from '../../types'

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

export type JobPatchFactory = (job: JobApplication) => JobFieldsPatch

export type WorkflowField = 'stage_details' | 'interview_sub_stages'

export interface PersistenceState {
  jobs: JobApplication[]
  selectedJob: JobApplication | null
  saveStates: Record<string, WorkflowSaveState>
  loading: boolean
  error: string | null
  isInitialized: boolean
  removeJobs: (ids: Iterable<string>) => void
}

export interface Runtime {
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

export type PersistenceGet = () => PersistenceState

export type PersistenceSet = (
  update:
    | Partial<PersistenceState>
    | ((state: PersistenceState) => Partial<PersistenceState>),
) => void
