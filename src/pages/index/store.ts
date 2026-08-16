import type { Resume, ResumeStats } from './types'
import { create } from 'zustand'
import { getAllOfflineResumes } from '@/lib/offline-resume-manager'
import { normalizeResumeType } from '@/lib/schema'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { getCurrentUser } from '@/lib/supabase/user'
import { diffDates } from '@/utils/date'

interface IndexStore {
  resumes: Resume[]
  loading: boolean
  isOnline: boolean
  loadData: () => Promise<void>
}

const useIndexStore = create<IndexStore>()(set => ({
  resumes: [],
  loading: true,
  isOnline: false,
  async loadData() {
    set({ loading: true, isOnline: false })
    try {
      const user = await getCurrentUser()
      let onlineResumes: Resume[] = []
      const isOnline = Boolean(user)

      // 认证状态一旦确定就立即发布，让不依赖简历列表的首页模块先开始加载。
      set({ isOnline })

      if (user) {
        const rawOnlineResumes = await getAllResumesFromUser()
        onlineResumes = rawOnlineResumes.map(r => ({
          ...r,
          type: normalizeResumeType(r.type),
          isOffline: false,
        }))
      }

      const localResumes = await getAllOfflineResumes()
      const offlineResumes: Resume[] = localResumes.map(r => ({
        resume_id: r.resume_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        type: normalizeResumeType(r.type),
        display_name: r.display_name,
        description: r.description,
        isOffline: true,
      }))

      set({
        isOnline,
        resumes: [...onlineResumes, ...offlineResumes],
      })
    }
    catch (error) {
      console.error('加载简历列表失败:', error)
    }
    finally {
      set({ loading: false })
    }
  },
}))

export default useIndexStore

export function selectStats(state: { resumes: Resume[] }): ResumeStats {
  const { resumes } = state
  const total = resumes.length
  const online = resumes.filter(r => !r.isOffline).length
  const offline = resumes.filter(r => r.isOffline).length

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentCount = resumes.filter(
    r => new Date(r.created_at) > sevenDaysAgo,
  ).length

  const sortedByDate = [...resumes].sort(
    (a, b) => diffDates(b.updated_at, a.updated_at),
  )
  const latestResume = sortedByDate[0]

  return { total, online, offline, recentCount, latestResume }
}
