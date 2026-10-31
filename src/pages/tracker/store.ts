import type { TrackerAccountScope } from './lib/account-scope'
import type {
  ApplicationStatus,
  JobApplication,
  TrackerMetricKey,
  TrackerSortBy,
  TrackerSortDir,
  ViewMode,
  ReopenProcessInput,
} from './types'
import { create } from 'zustand'
import { TrackerProcessError } from '@/lib/supabase/resume/tracker-companies'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
  subscribeTrackerAccountScope,
} from './lib/account-scope'
import { createTrackerPersistence } from './store/workflow-save'
import { createTrackerCompanies } from './store/companies'
import { createTrackerSubmissions } from './store/submissions'
import { filterJobs } from './utils'

interface TrackerStore
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
  submissionRevision: number
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
  selectAll: (viewMode?: ViewMode) => void
  openJobDrawer: (job: JobApplication) => void
  closeJobDrawer: () => void
  openAddDrawer: (sourceJob?: JobApplication) => void
  closeAddDrawer: () => void
  removeJobs: (ids: Iterable<string>) => void
  prependJob: (job: JobApplication, scope: TrackerAccountScope) => void
}

let pendingDrawerOpenFrame: number | null = null

function cancelPendingDrawerOpen() {
  if (pendingDrawerOpenFrame === null) return

  cancelAnimationFrame(pendingDrawerOpenFrame)
  pendingDrawerOpenFrame = null
}

const useTrackerStore = create<TrackerStore>()((set, get) => {
  const persistence = createTrackerPersistence(get, set)

  return {
    ...persistence,
    ...createTrackerCompanies(get, set),
    ...createTrackerSubmissions(set),
    correctJobStatus: (...args) => get().changeJobStatus(...args),
    reopenQueue: [],
    requestReopen: (jobId, target = 'interview') =>
      new Promise<void>((resolve) => {
        const job = get().jobs.find((row) => row.id === jobId)

        if (
          !job ||
          job.status !== 'rejected' ||
          get().reopenQueue.some((request) => request.jobId === jobId)
        )
          return resolve()

        set((state) => ({
          reopenQueue: [
            ...state.reopenQueue,
            { jobId, target, eventId: crypto.randomUUID(), resolve },
          ],
        }))
      }),
    finishReopen: () => {
      const current = get().reopenQueue[0]

      set((state) => ({ reopenQueue: state.reopenQueue.slice(1) }))
      current?.resolve()
    },
    submissionQueue: [],
    submissionRevision: 0,
    requestSubmission: (jobId) =>
      new Promise<void>((resolve) => {
        const job = get().jobs.find((row) => row.id === jobId)

        if (!job || job.user_id !== getTrackerAccountScope().userId)
          return resolve()
        if (get().submissionQueue.some((request) => request.jobId === jobId))
          return resolve()

        set((state) => ({
          submissionQueue: [
            ...state.submissionQueue,
            { id: crypto.randomUUID(), jobId, resolve },
          ],
        }))
      }),
    finishSubmission: () => {
      const current = get().submissionQueue[0]

      set((state) => ({
        submissionQueue: state.submissionQueue.slice(1),
        submissionRevision: state.submissionRevision + 1,
      }))

      current?.resolve()
    },
    changeJobStatus: (id, target, fields = {}) => {
      const job = get().jobs.find((row) => row.id === id)

      if (
        job?.status === 'rejected' &&
        ['applied', 'assessment', 'screen', 'written', 'interview'].includes(
          target,
        )
      )
        return get().requestReopen(
          id,
          target === 'applied'
            ? 'interview'
            : (target as ReopenProcessInput['target']),
        )
      if (target === 'applied' && !job?.has_submission)
        return get().requestSubmission(id)

      return persistence.changeJobStatus(id, target, fields)
    },
    // 初始状态
    jobs: [],
    accountScope: getTrackerAccountScope(),
    viewMode: 'board',
    loading: false,
    error: null,
    isInitialized: false,

    // 看板 UI
    rejectedCollapsed: true,

    // 选择模式
    selectedIds: new Set(),
    isSelectMode: false,

    // 筛选
    filterStatus: null,
    metricFilter: null,
    searchKeyword: '',
    showArchived: false,
    filterCompanyId: null,
    focusedOnly: false,
    groupByCompany: false,

    // 排序
    sortBy: 'updated',
    sortDir: 'desc',

    // Drawer
    selectedJob: null,
    drawerOpen: false,
    addDrawerOpen: false,
    referralSourceId: null,

    // 共享状态操作
    setViewMode: (mode) => set({ viewMode: mode }),
    setFilterStatus: (status) =>
      set({ filterStatus: status, metricFilter: null }),
    setMetricFilter: (key) =>
      set((state) => ({
        metricFilter: state.metricFilter === key ? null : key,
        filterStatus: null,
      })),
    clearFilters: () =>
      set({
        filterStatus: null,
        metricFilter: null,
        filterCompanyId: null,
        focusedOnly: false,
      }),
    setFocusedOnly: (value) =>
      set({ focusedOnly: value, selectedIds: new Set() }),
    toggleJobFocus: async (id, focused) => {
      const focusedAt = focused ? new Date().toISOString() : null

      await get().saveJobFields(id, () => {
        if (get().focusedOnly && !focused) {
          const selectedIds = new Set(get().selectedIds)

          selectedIds.delete(id)
          set({ selectedIds })
        }

        return { focused_at: focusedAt }
      })
    },
    setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
    setShowArchived: (value) => set({ showArchived: value }),
    setFilterCompanyId: (id) =>
      set({ filterCompanyId: id, selectedIds: new Set() }),
    setGroupByCompany: (value) => set({ groupByCompany: value }),
    setSort: (sortBy) =>
      set((state) =>
        state.sortBy === sortBy
          ? { sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' }
          : { sortBy, sortDir: 'desc' },
      ),
    toggleRejectedCollapsed: () =>
      set((state) => ({ rejectedCollapsed: !state.rejectedCollapsed })),
    enterSelectMode: () => set({ isSelectMode: true, selectedIds: new Set() }),
    exitSelectMode: () => set({ isSelectMode: false, selectedIds: new Set() }),
    toggleSelect: (id) => {
      set((state) => {
        const nextSelectedIds = new Set(state.selectedIds)

        if (nextSelectedIds.has(id)) {
          nextSelectedIds.delete(id)
        } else {
          nextSelectedIds.add(id)
        }

        return { selectedIds: nextSelectedIds }
      })
    },
    selectAll: (viewMode) => {
      set((state) => {
        const selectableJobs = filterJobs(
          state.filterCompanyId
            ? state.jobs.filter(
                (job) => job.tracker_company_id === state.filterCompanyId,
              )
            : state.jobs,
          (viewMode ?? state.viewMode) === 'list' ? state.filterStatus : null,
          state.searchKeyword,
          state.showArchived,
          (viewMode ?? state.viewMode) === 'list' ? state.metricFilter : null,
          state.focusedOnly,
        )

        return {
          selectedIds:
            state.selectedIds.size === selectableJobs.length
              ? new Set()
              : new Set(selectableJobs.map((job) => job.id)),
        }
      })
    },
    openJobDrawer: (job) => {
      const current = get().jobs.find(
        (row) =>
          row.id === job.id && row.user_id === getTrackerAccountScope().userId,
      )

      if (!current) return

      cancelPendingDrawerOpen()

      const previousId = get().selectedJob?.id

      if (previousId && previousId !== job.id)
        get()
          .flushWorkflow(previousId)
          .catch(() => {})

      set({ selectedJob: current, drawerOpen: false })

      // Base UI 需要先渲染一次关闭态的 Popup，下一帧切换 open 才能应用 starting-style。
      pendingDrawerOpenFrame = requestAnimationFrame(() => {
        pendingDrawerOpenFrame = null

        set((state) =>
          state.selectedJob?.id === job.id ? { drawerOpen: true } : {},
        )
      })
    },
    closeJobDrawer: () => {
      cancelPendingDrawerOpen()

      const id = get().selectedJob?.id

      if (id)
        get()
          .flushWorkflow(id)
          .catch(() => {})

      set({ drawerOpen: false })
    },
    openAddDrawer: (sourceJob) =>
      set({ addDrawerOpen: true, referralSourceId: sourceJob?.id ?? null }),
    closeAddDrawer: () => set({ addDrawerOpen: false, referralSourceId: null }),
    removeJobs: (ids) => {
      const idsSet = ids instanceof Set ? ids : new Set(ids)

      get().invalidateJobs(idsSet)

      set((state) => {
        const deletingSelectedJob = state.selectedJob
          ? idsSet.has(state.selectedJob.id)
          : false

        const nextSelectedIds = new Set(
          Array.from(state.selectedIds).filter((id) => !idsSet.has(id)),
        )

        return {
          jobs: state.jobs.filter((job) => !idsSet.has(job.id)),
          selectedIds: nextSelectedIds,
          saveStates: Object.fromEntries(
            Object.entries(state.saveStates).filter(([id]) => !idsSet.has(id)),
          ),
          isSelectMode: false,
          selectedJob: deletingSelectedJob ? null : state.selectedJob,
          drawerOpen: deletingSelectedJob ? false : state.drawerOpen,
        }
      })
    },
    prependJob: (job, scope) => {
      assertTrackerAccountScope(scope)

      if (job.user_id !== scope.userId) throw new Error('职位不属于当前账号')

      set((state) => ({
        jobs: [
          get().acceptNewJob(job),
          ...state.jobs.filter((row) => row.id !== job.id),
        ],
        saveStates: {
          ...state.saveStates,
          [job.id]: { status: 'idle', error: null },
        },
      }))

      get().loadCompanies(true)
    },
  }
})

// 即使页面已卸载，身份变化也必须同步终止旧队列；这里不发起网络请求。
subscribeTrackerAccountScope(() => {
  useTrackerStore.getState().reopenQueue.forEach((request) => request.resolve())

  useTrackerStore
    .getState()
    .submissionQueue.forEach((request) => request.resolve())

  cancelPendingDrawerOpen()
  useTrackerStore.getState().resetPersistence()

  useTrackerStore.setState({
    accountScope: getTrackerAccountScope(),
    submissionQueue: [],
    submissionsByJob: {},
    reopenQueue: [],
    jobs: [],
    selectedJob: null,
    selectedIds: new Set(),
    isSelectMode: false,
    drawerOpen: false,
    addDrawerOpen: false,
    saveStates: {},
    loading: false,
    error: null,
    isInitialized: false,
    searchKeyword: '',
    filterStatus: null,
    metricFilter: null,
    showArchived: false,
    filterCompanyId: null,
    focusedOnly: false,
    groupByCompany: false,
    referralSourceId: null,
    companies: [],
    companiesLoading: false,
    companiesError: null,
    companiesInitialized: false,
  })
})

export default useTrackerStore

export function getTrackerConflictAction(
  error: unknown,
  beforeOpen?: () => void,
) {
  const conflict =
    error instanceof TrackerProcessError
      ? useTrackerStore
          .getState()
          .jobs.find((job) => job.id === error.conflictJobId)
      : null

  if (!conflict) return undefined

  return {
    label: '打开冲突岗位',
    onClick: () => {
      beforeOpen?.()
      useTrackerStore.getState().openJobDrawer(conflict)
    },
  }
}
