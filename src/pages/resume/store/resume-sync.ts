import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../types'
import type { ResumeListState } from './types'
import { toast } from 'sonner'
import { syncOfflineResumesToCloud } from '@/lib/resume-sync-service'
import { subscribeToResumeConfigUpdates } from '@/lib/supabase/resume'
import { getAllResumesFromUser } from '@/lib/supabase/resume/form'

export interface ResumeSyncSlice {
  isOnline: boolean
  offlineResumes: ResumeItem[]
  isSyncing: boolean
  syncingIds: Set<string>
  syncResumes: (selectedIds: string[]) => Promise<void>
  setupRealtimeSubscription: () => () => void
}

type SetState = StoreApi<ResumeListState>['setState']
type GetState = StoreApi<ResumeListState>['getState']

export function createResumeSyncSlice(set: SetState, get: GetState): ResumeSyncSlice {
  return {
    isOnline: false,
    offlineResumes: [],
    isSyncing: false,
    syncingIds: new Set<string>(),

    syncResumes: async (selectedIds: string[]) => {
      if (selectedIds.length === 0)
        return

      set({ isSyncing: true, syncingIds: new Set(selectedIds) })

      try {
        const result = await syncOfflineResumesToCloud(selectedIds)

        if (result.success > 0) {
          const successIds = new Set(result.successIds)
          set((state) => {
            const remaining = state.offlineResumes.filter(r => !successIds.has(r.resume_id))
            return {
              resumes: state.resumes.filter(r => !r.isOffline || !successIds.has(r.resume_id)),
              offlineResumes: remaining,
              showSyncDialog: remaining.length === 0 ? false : state.showSyncDialog,
            }
          })

          toast.success(`已同步 ${result.success} 个简历到云端`)
        }

        if (result.failed > 0)
          toast.error(`${result.failed} 个简历同步失败`)

        if (result.success > 0) {
          try {
            const onlineResumes = await getAllResumesFromUser()
            const newOnlineResumes = onlineResumes.map(r => ({ ...r, isOffline: false }))
            set(state => ({
              resumes: [...newOnlineResumes, ...state.resumes.filter(r => r.isOffline)],
            }))
          }
          catch {
            toast.error('云端列表刷新失败，请刷新页面查看已同步简历')
          }
        }
      }
      catch {
        toast.error('同步失败，请稍后重试')
      }
      finally {
        set({ isSyncing: false, syncingIds: new Set() })
      }
    },

    setupRealtimeSubscription: () => {
      let cancelled = false
      let unSubscribe: (() => void) | undefined

      subscribeToResumeConfigUpdates((payload) => {
        if (cancelled)
          return

        switch (payload.eventType) {
          case 'INSERT': {
            const resume: ResumeItem = {
              resume_id: payload.new.resume_id,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
              type: payload.new.type,
              display_name: payload.new.display_name,
              description: payload.new.description,
              isOffline: false,
            }
            set((state) => {
              if (state.resumes.some(r => r.resume_id === resume.resume_id))
                return state
              return { resumes: [resume, ...state.resumes] }
            })
            break
          }
          case 'UPDATE': {
            set(state => ({
              resumes: state.resumes.map(r =>
                r.resume_id === payload.new.resume_id
                  ? {
                      ...r,
                      display_name: payload.new.display_name,
                      description: payload.new.description,
                      updated_at: payload.new.updated_at,
                    }
                  : r,
              ),
            }))
            break
          }
          case 'DELETE': {
            const deletedResumeId = payload.old.resume_id
            const { _localDeletingIds, resumes } = get()
            const existsLocally = resumes.some(resume => resume.resume_id === deletedResumeId)

            if (_localDeletingIds.has(deletedResumeId) || !existsLocally) {
              set((state) => {
                const newSet = new Set(state._localDeletingIds)
                newSet.delete(deletedResumeId)
                return { _localDeletingIds: newSet }
              })
              break
            }

            const syncPromise = async () => {
              const onlineResumes = await getAllResumesFromUser()
              const formattedOnlineResumes = onlineResumes.map(r => ({ ...r, isOffline: false }))

              set((state) => {
                const offlineOnly = state.resumes.filter(r => r.isOffline)
                return { resumes: [...formattedOnlineResumes, ...offlineOnly] }
              })
            }

            toast.promise(syncPromise, {
              loading: '检测到简历变动，正在同步...',
              success: '简历已同步删除',
              error: '同步失败，请重试',
            })
            break
          }
        }
      })
        .then((unsub) => {
          if (cancelled)
            unsub?.()
          else
            unSubscribe = unsub
        })
        .catch((error) => {
          console.error(error.message)
        })

      return () => {
        cancelled = true
        unSubscribe?.()
      }
    },
  }
}
