import type { Resume, ResumeStats } from './types'
import { create } from 'zustand'
import { getAllOfflineResumes } from '@/lib/offline-resume-manager'
import { normalizeResumeType } from '@/lib/schema'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { getCurrentUser } from '@/lib/supabase/user'
import { diffDates } from '@/utils/date'

interface ResumeResourceState {
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
  cloud: { loading: true, error: null, hasLoaded: false },
  local: { loading: true, error: null, hasLoaded: false },
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
    const requestId = ++loadRequestId
    set((state) => ({
      error: null,
      cloud: { ...state.cloud, loading: true, error: null },
      local: { ...state.local, loading: true, error: null },
    }))
    if (!get().initialized && !get().loading) set({ loading: true })
    try {
      const user = await getCurrentUser()
      if (requestId !== loadRequestId) return
      let onlineResumes: Resume[] = []
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
              cloud: { loading: true, error: null, hasLoaded: false },
              local: { loading: true, error: null, hasLoaded: false },
            }
          : {}),
      }))

      const outcomes = await Promise.allSettled([
        (async () => {
          try {
            const rawOnlineResumes = user ? await getAllResumesFromUser() : []
            onlineResumes = rawOnlineResumes.map((r) => ({
              ...r,
              type: normalizeResumeType(r.type),
              isOffline: false,
            }))
            if (requestId === loadRequestId)
              set((state) => ({
                resumes: [
                  ...onlineResumes,
                  ...state.resumes.filter((r) => r.isOffline),
                ],
                cloud: { loading: false, error: null, hasLoaded: true },
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
            const localResumes = await getAllOfflineResumes()
            const offlineResumes: Resume[] = localResumes.map((r) => ({
              ...r,
              type: normalizeResumeType(r.type),
              isOffline: true,
            }))
            if (requestId === loadRequestId)
              set((state) => ({
                resumes: [
                  ...state.resumes.filter((r) => !r.isOffline),
                  ...offlineResumes,
                ],
                local: { loading: false, error: null, hasLoaded: true },
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

export function selectStats(state: { resumes: Resume[] }): ResumeStats {
  const { resumes } = state
  const total = resumes.length
  const online = resumes.filter((r) => !r.isOffline).length
  const offline = resumes.filter((r) => r.isOffline).length

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentCount = resumes.filter(
    (r) => new Date(r.created_at) > sevenDaysAgo,
  ).length

  const sortedByDate = [...resumes].sort((a, b) =>
    diffDates(b.updated_at, a.updated_at),
  )
  const latestResume = sortedByDate[0]

  return { total, online, offline, recentCount, latestResume }
}
