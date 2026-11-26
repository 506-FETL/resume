import type { TrackerAccountScope } from '../lib/account-scope'
import type {
  ApplicationStatus,
  JobApplication,
  TrackerMetricKey,
  TrackerSortBy,
  TrackerSortDir,
  ViewMode,
  ReopenProcessInput,
} from '../types'
import type { createTrackerPersistence } from './workflow-save'
import type { createTrackerCompanies } from './companies'
import type { createTrackerSubmissions } from './submissions'

export interface TrackerStore
  extends
    ReturnType<typeof createTrackerPersistence>,
    ReturnType<typeof createTrackerCompanies>,
    ReturnType<typeof createTrackerSubmissions> {
  reopenQueue: {
    jobId: string
    eventId: string
    target: ReopenProcessInput['target']
    resolve: () => void
  }[]
  requestReopen: (
    jobId: string,
    target?: ReopenProcessInput['target'],
  ) => Promise<void>
  finishReopen: () => void
  submissionQueue: { id: string; jobId: string; resolve: () => void }[]
  requestSubmission: (jobId: string) => Promise<void>
  finishSubmission: () => void
  correctJobStatus: ReturnType<
    typeof createTrackerPersistence
  >['changeJobStatus']
  // 数据
  jobs: JobApplication[]
  accountScope: TrackerAccountScope
  viewMode: ViewMode
  loading: boolean
  error: string | null
  isInitialized: boolean

  // 看板 UI
  rejectedCollapsed: boolean

  // 选择模式
  selectedIds: Set<string>
  isSelectMode: boolean

  // 筛选
  filterStatus: ApplicationStatus | null
  metricFilter: TrackerMetricKey | null
  searchKeyword: string
  showArchived: boolean
  filterCompanyId: string | null
  focusedOnly: boolean
  toggleJobFocus: (id: string, focused: boolean) => Promise<void>
  setFocusedOnly: (value: boolean) => void
  groupByCompany: boolean

  // 排序（仅列表视图消费）
  sortBy: TrackerSortBy
  sortDir: TrackerSortDir

  // Drawer
  drawerWorkflowRead: Promise<void> | null
  selectedJob: JobApplication | null
  drawerOpen: boolean
  addDrawerOpen: boolean
  referralSourceId: string | null

  // 共享状态操作
  setViewMode: (mode: ViewMode) => void
  setFilterStatus: (status: ApplicationStatus | null) => void
  setMetricFilter: (key: TrackerMetricKey | null) => void
  clearFilters: () => void
  setSearchKeyword: (keyword: string) => void
  toggleRejectedCollapsed: () => void
  setShowArchived: (value: boolean) => void
  setFilterCompanyId: (id: string | null) => void
  setGroupByCompany: (value: boolean) => void
  setSort: (sortBy: TrackerSortBy) => void
  enterSelectMode: () => void
  exitSelectMode: () => void
  toggleSelect: (id: string) => void
  selectAll: () => Promise<void>
  openJobDrawer: (job: JobApplication) => void
  closeJobDrawer: () => void
  openAddDrawer: (sourceJob?: JobApplication) => void
  closeAddDrawer: () => void
  removeJobs: (ids: Iterable<string>) => void
  prependJob: (job: JobApplication, scope: TrackerAccountScope) => void
}
