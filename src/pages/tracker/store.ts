import type { ApplicationStatus, JobApplication, ViewMode } from './types'
import { toast } from 'sonner'
import { create } from 'zustand'
import { mockApplications } from './mock-data'

interface TrackerStore {
  // 状态
  jobs: JobApplication[]
  viewMode: ViewMode
  selectedJob: JobApplication | null
  drawerOpen: boolean
  addDrawerOpen: boolean
  selectedIds: Set<string>
  isSelectMode: boolean

  // 操作
  init: () => void
  setViewMode: (mode: ViewMode) => void
  updateJobStatus: (jobId: string, status: ApplicationStatus) => void
  addJob: (job: Omit<JobApplication, 'id' | 'created_at'>) => void
  deleteSelectedJobs: () => void

  // Drawer
  openDrawer: (job: JobApplication) => void
  closeDrawer: () => void
  setAddDrawerOpen: (open: boolean) => void
  updateJob: (job: JobApplication) => void

  // 选择模式
  enterSelectMode: () => void
  exitSelectMode: () => void
  toggleSelect: (id: string) => void
  selectAll: () => void
}

const useTrackerStore = create<TrackerStore>()((set, get) => ({
  // 初始状态
  jobs: [],
  viewMode: 'list',
  selectedJob: null,
  drawerOpen: false,
  addDrawerOpen: false,
  selectedIds: new Set(),
  isSelectMode: false,

  init: () => {
    set({ jobs: mockApplications })
  },

  setViewMode: mode => set({ viewMode: mode }),

  updateJobStatus: (jobId, status) => {
    const { jobs, selectedJob } = get()
    const updatedJobs = jobs.map(j => j.id === jobId ? { ...j, status } : j)
    set({ jobs: updatedJobs })

    if (selectedJob?.id === jobId) {
      set({ selectedJob: { ...selectedJob, status } })
    }
    toast.success(`状态已更新为 ${status}`)
  },

  addJob: (jobData) => {
    const newJob: JobApplication = {
      ...jobData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    }
    set(state => ({ jobs: [newJob, ...state.jobs] }))
    set({ addDrawerOpen: false })
    toast.success('添加成功')
  },

  deleteSelectedJobs: () => {
    const { selectedIds } = get()
    set(state => ({
      jobs: state.jobs.filter(j => !state.selectedIds.has(j.id)),
      selectedIds: new Set(),
      isSelectMode: false,
    }))
    toast.success(`已删除 ${selectedIds.size} 个职位`)
  },

  openDrawer: (job) => {
    const { isSelectMode } = get()
    if (isSelectMode)
      return // 选择模式下不打开 Drawer
    set({ selectedJob: job, drawerOpen: true })
  },

  closeDrawer: () => set({ drawerOpen: false }),

  setAddDrawerOpen: open => set({ addDrawerOpen: open }),

  updateJob: (job) => {
    set(state => ({
      jobs: state.jobs.map(j => j.id === job.id ? job : j),
      selectedJob: job,
    }))
  },

  enterSelectMode: () => set({ isSelectMode: true, selectedIds: new Set() }),

  exitSelectMode: () => set({ isSelectMode: false, selectedIds: new Set() }),

  toggleSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { selectedIds: next }
    })
  },

  selectAll: () => {
    const { jobs, selectedIds } = get()
    if (selectedIds.size === jobs.length) {
      set({ selectedIds: new Set() })
    }
    else {
      set({ selectedIds: new Set(jobs.map(j => j.id)) })
    }
  },
}))

export default useTrackerStore
