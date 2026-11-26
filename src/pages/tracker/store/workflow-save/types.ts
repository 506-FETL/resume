import type {
  TrackerCounts,
  TrackerHistoryCounts,
  TrackerLane,
} from '@/lib/supabase/resume/company/tracker-pages'
import type {
  JobApplication,
  ViewMode,
  ApplicationStatus,
  TrackerMetricKey,
  TrackerSortBy,
  TrackerSortDir,
} from '../../types'

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
  viewMode: ViewMode
  showArchived: boolean
  filterCompanyId: string | null
  focusedOnly: boolean
  filterStatus: ApplicationStatus | null
  metricFilter: TrackerMetricKey | null
  searchKeyword: string
  groupByCompany: boolean
  isSelectMode: boolean
  sortBy: TrackerSortBy
  sortDir: TrackerSortDir
  viewJobIds: Set<string>
  baseScopeComplete: boolean
  scopeComplete: boolean
  pageMore: Partial<Record<TrackerLane, boolean>>
  pageLoading: Partial<Record<TrackerLane, boolean>>
  pageErrors: Partial<Record<TrackerLane, string>>
  historyCounts: TrackerHistoryCounts | null
  countsKey: string | null
  counts: TrackerCounts | null
  countsError: string | null
  resetCompanyOptions: () => void
  rememberJob: (job: JobApplication) => void
  refreshJobCounts: () => Promise<void>
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
