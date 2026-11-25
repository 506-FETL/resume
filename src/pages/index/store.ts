import type { Resume } from './types'
import { create } from 'zustand'
import { getDashboardOfflineResumes } from '@/lib/offline-resume-manager/dashboard'
import useUserStore from '@/store/user'

interface ResumeResourceState {
  total: number
  loading: boolean
  error: string | null
  hasLoaded: boolean
}

interface IndexStore {
  cloud: ResumeResourceState
  local: ResumeResourceState
  resumes: Resume[]
  loading: boolean
  error: string | null
  cancelLoad: () => void
  accountId: string | null
  initialized: boolean
  isOnline: boolean
  loadData: () => Promise<void>
}

let loadRequestId = 0

const useIndexStore = create<IndexStore>()((set, get) => ({
  cloud: { total: 0, loading: true, error: null, hasLoaded: false },
  local: { total: 0, loading: true, error: null, hasLoaded: false },
  resumes: [],
  loading: true,
  accountId: null,
  error: null,
  cancelLoad: () => {
    loadRequestId += 1
  },
  initialized: false,
  isOnline: false,
  async loadData() {
    if (useUserStore.getState().authStatus === 'unknown') return

    const requestId = ++loadRequestId

    set((state) => ({
      error: null,
      cloud: { ...state.cloud, loading: true, error: null },
      local: { ...state.local, loading: true, error: null },
    }))

    if (!get().initialized && !get().loading) set({ loading: true })

    try {
      const user = useUserStore.getState().currentUser

      if (requestId !== loadRequestId) return

      const isOnline = Boolean(user)

      // 认证状态一旦确定就立即发布，让不依赖简历列表的首页模块先开始加载。
      set((state) => ({
        isOnline,
        accountId: user?.id ?? null,
        ...(state.accountId !== (user?.id ?? null)
          ? {
              resumes: [],
              initialized: false,
              loading: true,
              cloud: { total: 0, loading: true, error: null, hasLoaded: false },
              local: { total: 0, loading: true, error: null, hasLoaded: false },
            }
          : {}),
      }))

      const outcomes = await Promise.allSettled([
        (async () => {
          try {
            const { items, total } = user
              ? await import('@/lib/supabase/resume/summaries').then((module) =>
                  module.getDashboardCloudResumes(user.id),
                )
              : { items: [], total: 0 }

            if (requestId === loadRequestId)
              set((state) => ({
                resumes: [
                  ...items,
                  ...state.resumes.filter((r) => r.isOffline),
                ],
                cloud: { total, loading: false, error: null, hasLoaded: true },
              }))
          } catch (error) {
            if (requestId === loadRequestId)
              set((state) => ({
                cloud: {
                  ...state.cloud,
                  loading: false,
                  error: '云端简历加载失败',
                },
              }))

            throw error
          }
        })(),
        (async () => {
          try {
            const { items, total } = await getDashboardOfflineResumes()

            if (requestId === loadRequestId)
              set((state) => ({
                resumes: [
                  ...state.resumes.filter((r) => !r.isOffline),
                  ...items,
                ],
                local: { total, loading: false, error: null, hasLoaded: true },
              }))
          } catch (error) {
            if (requestId === loadRequestId)
              set((state) => ({
                local: {
                  ...state.local,
                  loading: false,
                  error: '本地简历加载失败',
                },
              }))

            throw error
          }
        })(),
      ])

      if (requestId !== loadRequestId) return

      const failed = outcomes.some((outcome) => outcome.status === 'rejected')

      set({
        isOnline,
        error: failed ? '部分简历加载失败' : null,
        initialized: true,
        loading: false,
      })
    } catch (error) {
      if (requestId === loadRequestId)
        set((state) => ({
          error: '加载失败',
          cloud: { ...state.cloud, loading: false, error: '无法确认云端简历' },
          local: { ...state.local, loading: false },
        }))

      console.error('加载简历列表失败:', error)
    } finally {
      if (requestId === loadRequestId && get().loading) set({ loading: false })
    }
  },
}))

export default useIndexStore
