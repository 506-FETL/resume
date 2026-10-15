import type { TrackerAccountScope } from './lib/account-scope'
import type { ApplicationStatus, JobApplication, TrackerMetricKey, TrackerSortBy, TrackerSortDir, ViewMode } from './types'
import { create } from 'zustand'
import { assertTrackerAccountScope, getTrackerAccountScope, subscribeTrackerAccountScope } from './lib/account-scope'
import { createTrackerPersistence } from './store/workflow-save'
import { filterJobs } from './utils'

interface TrackerStore extends ReturnType<typeof createTrackerPersistence> {
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

  // 排序（仅列表视图消费）
  sortBy: TrackerSortBy
  sortDir: TrackerSortDir

  // Drawer
  selectedJob: JobApplication | null
  drawerOpen: boolean
  addDrawerOpen: boolean

  // 共享状态操作
  setViewMode: (mode: ViewMode) => void
  setFilterStatus: (status: ApplicationStatus | null) => void
  setMetricFilter: (key: TrackerMetricKey | null) => void
  clearFilters: () => void
  setSearchKeyword: (keyword: string) => void
  toggleRejectedCollapsed: () => void
  setShowArchived: (value: boolean) => void
  setSort: (sortBy: TrackerSortBy) => void
  enterSelectMode: () => void
  exitSelectMode: () => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  openJobDrawer: (job: JobApplication) => void
  closeJobDrawer: () => void
  openAddDrawer: () => void
  closeAddDrawer: () => void
  removeJobs: (ids: Iterable<string>) => void
  prependJob: (job: JobApplication, scope: TrackerAccountScope) => void
}

let pendingDrawerOpenFrame: number | null = null

function cancelPendingDrawerOpen() {
  if (pendingDrawerOpenFrame === null)
    return
  cancelAnimationFrame(pendingDrawerOpenFrame)
  pendingDrawerOpenFrame = null
}

const useTrackerStore = create<TrackerStore>()((set, get) => {
  return {
    ...createTrackerPersistence(get, set),
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

    // 排序
    sortBy: 'updated',
    sortDir: 'desc',

    // Drawer
    selectedJob: null,
    drawerOpen: false,
    addDrawerOpen: false,

    // 共享状态操作
    setViewMode: mode => set({ viewMode: mode }),
    setFilterStatus: status => set({ filterStatus: status, metricFilter: null }),
    setMetricFilter: key => set(state => ({
      metricFilter: state.metricFilter === key ? null : key,
      filterStatus: null,
    })),
    clearFilters: () => set({ filterStatus: null, metricFilter: null }),
    setSearchKeyword: keyword => set({ searchKeyword: keyword }),
    setShowArchived: value => set({ showArchived: value }),
    setSort: sortBy => set(state => (
      state.sortBy === sortBy
        ? { sortDir: state.sortDir === 'asc' ? 'desc' : 'asc' }
        : { sortBy, sortDir: 'desc' }
    )),
    toggleRejectedCollapsed: () => set(state => ({ rejectedCollapsed: !state.rejectedCollapsed })),
    enterSelectMode: () => set({ isSelectMode: true, selectedIds: new Set() }),
    exitSelectMode: () => set({ isSelectMode: false, selectedIds: new Set() }),
    toggleSelect: (id) => {
      set((state) => {
        const nextSelectedIds = new Set(state.selectedIds)
        if (nextSelectedIds.has(id)) {
          nextSelectedIds.delete(id)
        }
        else {
          nextSelectedIds.add(id)
        }
        return { selectedIds: nextSelectedIds }
      })
    },
    selectAll: () => {
      set((state) => {
        const selectableJobs = filterJobs(
          state.jobs,
          state.viewMode === 'list' ? state.filterStatus : null,
          state.searchKeyword,
          state.showArchived,
          state.viewMode === 'list' ? state.metricFilter : null,
        )

        return {
          selectedIds: state.selectedIds.size === selectableJobs.length
            ? new Set()
            : new Set(selectableJobs.map(job => job.id)),
        }
      })
    },
    openJobDrawer: (job) => {
      const current = get().jobs.find(row => row.id === job.id && row.user_id === getTrackerAccountScope().userId)
      if (!current)
        return
      cancelPendingDrawerOpen()
      const previousId = get().selectedJob?.id
      if (previousId && previousId !== job.id)
        get().flushWorkflow(previousId).catch(() => {})
      set({ selectedJob: current, drawerOpen: false })
      // Base UI 需要先渲染一次关闭态的 Popup，下一帧切换 open 才能应用 starting-style。
      pendingDrawerOpenFrame = requestAnimationFrame(() => {
        pendingDrawerOpenFrame = null
        set(state => state.selectedJob?.id === job.id ? { drawerOpen: true } : {})
      })
    },
    closeJobDrawer: () => {
      cancelPendingDrawerOpen()
      const id = get().selectedJob?.id
      if (id)
        get().flushWorkflow(id).catch(() => {})
      set({ drawerOpen: false })
    },
    openAddDrawer: () => set({ addDrawerOpen: true }),
    closeAddDrawer: () => set({ addDrawerOpen: false }),
    removeJobs: (ids) => {
      const idsSet = ids instanceof Set ? ids : new Set(ids)

      get().invalidateJobs(idsSet)
      set((state) => {
        const deletingSelectedJob = state.selectedJob ? idsSet.has(state.selectedJob.id) : false
        const nextSelectedIds = new Set(
          Array.from(state.selectedIds).filter(id => !idsSet.has(id)),
        )

        return {
          jobs: state.jobs.filter(job => !idsSet.has(job.id)),
          selectedIds: nextSelectedIds,
          saveStates: Object.fromEntries(Object.entries(state.saveStates).filter(([id]) => !idsSet.has(id))),
          isSelectMode: false,
          selectedJob: deletingSelectedJob ? null : state.selectedJob,
          drawerOpen: deletingSelectedJob ? false : state.drawerOpen,
        }
      })
    },
    prependJob: (job, scope) => {
      assertTrackerAccountScope(scope)
      if (job.user_id !== scope.userId)
        throw new Error('职位不属于当前账号')
      set(state => ({ jobs: [get().acceptNewJob(job), ...state.jobs.filter(row => row.id !== job.id)], saveStates: { ...state.saveStates, [job.id]: { status: 'idle', error: null } } }))
    },
  }
})

// 即使页面已卸载，身份变化也必须同步终止旧队列；这里不发起网络请求。
subscribeTrackerAccountScope(() => {
  cancelPendingDrawerOpen()
  useTrackerStore.getState().resetPersistence()
  useTrackerStore.setState({
    accountScope: getTrackerAccountScope(),
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
  })
})

export default useTrackerStore
