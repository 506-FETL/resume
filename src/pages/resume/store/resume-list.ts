import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../types'
import type { ResumeListState } from './types'
import { toast } from 'sonner'
import { deleteOfflineResume, getAllOfflineResumes, isOfflineResumeId } from '@/lib/offline-resume-manager'
import { deleteResume as deleteResumeApi, getAllResumesFromUser } from '@/lib/supabase/resume/form'
import { getCurrentUser } from '@/lib/supabase/user'
import useCurrentResumeStore from '@/store/resume/current'
import { getErrorMessage } from '@/utils'

export interface ResumeListSlice {
  resumes: ResumeItem[]
  loading: boolean
  _localDeletingIds: Set<string>
  loadResumes: () => Promise<void>
  deleteResume: (id: string) => void
  updateResume: (resumeId: string, updates: { display_name: string, description: string }) => void
  addResume: (resume: ResumeItem) => void
}

type SetState = StoreApi<ResumeListState>['setState']

function clearDeletedCurrentResume(resumeId: string) {
  const currentResume = useCurrentResumeStore.getState()
  if (currentResume.resumeId === resumeId)
    currentResume.clearCurrentResume()
}

export function createResumeListSlice(set: SetState): ResumeListSlice {
  return {
    resumes: [],
    loading: true,
    _localDeletingIds: new Set<string>(),

    loadResumes: async () => {
      try {
        const user = await getCurrentUser()
        set({ isOnline: !!user })

        let allResumes: ResumeItem[] = []

        if (user) {
          try {
            const onlineResumes = await getAllResumesFromUser()
            allResumes = onlineResumes.map(r => ({ ...r, isOffline: false }))
          }
          catch (error: unknown) {
            if (getErrorMessage(error) !== '用户未登陆')
              toast.error('加载在线简历失败')
          }
        }

        const localResumes = await getAllOfflineResumes()
        const formattedOfflineResumes: ResumeItem[] = localResumes.map(r => ({
          ...r,
          isOffline: true,
        }))

        allResumes = [...allResumes, ...formattedOfflineResumes]
        set({ resumes: allResumes })

        if (user && formattedOfflineResumes.length > 0) {
          set({ offlineResumes: formattedOfflineResumes })
          toast.info(`检测到 ${formattedOfflineResumes.length} 个本地简历，点击右上角按钮可同步到云端`)
        }
      }
      catch (error) {
        toast.error('加载简历失败')
        console.warn(error)
      }
      finally {
        set({ loading: false })
      }
    },

    deleteResume: (id: string) => {
      const isOffline = isOfflineResumeId(id)

      if (!isOffline) {
        set((state) => {
          const newSet = new Set(state._localDeletingIds)
          newSet.add(id)
          return { _localDeletingIds: newSet }
        })
      }

      const deletePromise = isOffline
        ? deleteOfflineResume(id).then(() => {
            set(state => ({
              resumes: state.resumes.filter(r => r.resume_id !== id),
              offlineResumes: state.offlineResumes.filter(r => r.resume_id !== id),
            }))
            clearDeletedCurrentResume(id)
          })
        : deleteResumeApi(id).then(() => {
            set(state => ({
              resumes: state.resumes.filter(r => r.resume_id !== id),
            }))
            clearDeletedCurrentResume(id)
          })

      toast.promise(deletePromise, {
        loading: '正在删除简历...',
        success: '简历已删除',
        error: () => {
          if (!isOffline) {
            set((state) => {
              const newSet = new Set(state._localDeletingIds)
              newSet.delete(id)
              return { _localDeletingIds: newSet }
            })
          }
          return '删除失败，请重试'
        },
      })
    },

    updateResume: (resumeId, updates) => {
      set(state => ({
        resumes: state.resumes.map(r =>
          r.resume_id === resumeId ? { ...r, ...updates } : r,
        ),
        offlineResumes: resumeId.startsWith('local-')
          ? state.offlineResumes.map(r =>
              r.resume_id === resumeId ? { ...r, ...updates } : r,
            )
          : state.offlineResumes,
      }))
    },

    addResume: (resume) => {
      set(state => ({
        resumes: state.resumes.some(item => item.resume_id === resume.resume_id)
          ? state.resumes
          : [resume, ...state.resumes],
        offlineResumes: resume.isOffline && !state.offlineResumes.some(item => item.resume_id === resume.resume_id)
          ? [resume, ...state.offlineResumes]
          : state.offlineResumes,
      }))
    },
  }
}
