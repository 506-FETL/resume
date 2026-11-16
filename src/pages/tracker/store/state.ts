import type { ReopenProcessInput } from '../types'
import { create } from 'zustand'
import {
  assertTrackerAccountScope,
  getTrackerAccountScope,
  subscribeTrackerAccountScope,
} from '../lib/account-scope'
import { createTrackerPersistence } from './workflow-save'
import { createTrackerCompanies } from './companies'
import { createTrackerSubmissions } from './submissions'
import { filterJobs } from '../utils'
import type { TrackerStore } from './types'

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
    ...createTrackerSubmissions(get, set),
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
      set({ filterStatus: status, metricFilter: null, selectedIds: new Set() }),
    setMetricFilter: (key) =>
      set((state) => ({
        metricFilter: state.metricFilter === key ? null : key,
        filterStatus: null,
        selectedIds: new Set(),
      })),
    clearFilters: () =>
      set({
        filterStatus: null,
        metricFilter: null,
        filterCompanyId: null,
        focusedOnly: false,
        selectedIds: new Set(),
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
    setSearchKeyword: (keyword) =>
      set({ searchKeyword: keyword, selectedIds: new Set() }),
    setShowArchived: (value) =>
      set({ showArchived: value, selectedIds: new Set() }),
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
    selectAll: () => {
      set((state) => {
        const selectableJobs = filterJobs(
          state.filterCompanyId
            ? state.jobs.filter(
                (job) => job.tracker_company_id === state.filterCompanyId,
              )
            : state.jobs,
          state.filterStatus,
          state.searchKeyword,
          state.showArchived,
          state.metricFilter,
          state.focusedOnly,
        )

        return {
          selectedIds: selectableJobs.every((job) =>
            state.selectedIds.has(job.id),
          )
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
    submissionJdsById: {},
    submissionHistoriesById: {},
    submissionMaterialsByKey: {},
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
