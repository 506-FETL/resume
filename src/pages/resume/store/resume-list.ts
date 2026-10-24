import type { StoreApi } from 'zustand'
import type { ResumeItem } from '../types'
import type { ResumeListState } from './types'
import { toast } from 'sonner'
import {
  deleteOfflineResume,
  getAllOfflineResumes,
  isOfflineResumeId,
} from '@/lib/offline-resume-manager'
import { readResumeListTemplateBinding } from '@/lib/resume-template/binding'
import {
  deleteResume as deleteResumeApi,
  getAllResumesFromUser,
} from '@/lib/supabase/resume/form'
import { getCurrentUser } from '@/lib/supabase/user'
import useCurrentResumeStore from '@/store/resume/current'
import { getErrorMessage } from '@/utils'

export interface ResumeListSlice {
  resumes: ResumeItem[]
  loading: boolean
  loadError: string | null
  accountId: string | null
  cancelLoad: () => void
  _localDeletingIds: Set<string>
  loadResumes: () => Promise<void>
  deleteResume: (id: string) => void
  updateResume: (
    resumeId: string,
    updates: { display_name: string; description: string },
  ) => void
  addResume: (resume: ResumeItem) => void
}

type SetState = StoreApi<ResumeListState>['setState']

function clearDeletedCurrentResume(resumeId: string) {
  const currentResume = useCurrentResumeStore.getState()

  if (currentResume.resumeId === resumeId) currentResume.clearCurrentResume()
}

export function createResumeListSlice(set: SetState): ResumeListSlice {
  let requestId = 0
  let accountId: string | null | undefined

  return {
    resumes: [],
    loading: true,
    loadError: null,
    accountId: null,
    cancelLoad: () => {
      requestId += 1
    },
    _localDeletingIds: new Set<string>(),

    loadResumes: async () => {
      const request = ++requestId

      set({ loadError: null })

      try {
        const user = await getCurrentUser()

        if (request !== requestId) return

        const nextAccountId = user?.id ?? null

        if (accountId !== nextAccountId) {
          accountId = nextAccountId

          set({
            resumes: [],
            offlineResumes: [],
            loading: true,
            accountId: nextAccountId,
          })
        }

        set({ isOnline: Boolean(user) })

        const outcomes = await Promise.allSettled([
          (async () => {
            const onlineResumes = user ? await getAllResumesFromUser() : []

            if (request === requestId)
              set((state) => ({
                resumes: [
                  ...onlineResumes.map((r) => ({ ...r, isOffline: false })),
                  ...state.resumes.filter((r) => r.isOffline),
                ],
              }))
          })(),
          (async () => {
            const localResumes = await getAllOfflineResumes()

            const offlineResumes = localResumes.map((r) => ({
              ...r,
              isOffline: true,
              templateBinding: readResumeListTemplateBinding(
                r.data.templateBinding,
              ),
            }))

            if (request === requestId)
              set((state) => ({
                resumes: [
                  ...state.resumes.filter((r) => !r.isOffline),
                  ...offlineResumes,
                ],
                offlineResumes,
              }))
          })(),
        ])

        if (request !== requestId) return

        const failed = outcomes.find((outcome) => outcome.status === 'rejected')

        if (failed?.status === 'rejected')
          set({ loadError: getErrorMessage(failed.reason) })
      } catch (error) {
        if (request === requestId) set({ loadError: getErrorMessage(error) })
      } finally {
        if (request === requestId) set({ loading: false })
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
            set((state) => ({
              resumes: state.resumes.filter((r) => r.resume_id !== id),
              offlineResumes: state.offlineResumes.filter(
                (r) => r.resume_id !== id,
              ),
            }))

            clearDeletedCurrentResume(id)
          })
        : deleteResumeApi(id).then(() => {
            set((state) => ({
              resumes: state.resumes.filter((r) => r.resume_id !== id),
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
      set((state) => ({
        resumes: state.resumes.map((r) =>
          r.resume_id === resumeId ? { ...r, ...updates } : r,
        ),
        offlineResumes: resumeId.startsWith('local-')
          ? state.offlineResumes.map((r) =>
              r.resume_id === resumeId ? { ...r, ...updates } : r,
            )
          : state.offlineResumes,
      }))
    },

    addResume: (resume) => {
      set((state) => ({
        resumes: state.resumes.some(
          (item) => item.resume_id === resume.resume_id,
        )
          ? state.resumes
          : [resume, ...state.resumes],
        offlineResumes:
          resume.isOffline &&
          !state.offlineResumes.some(
            (item) => item.resume_id === resume.resume_id,
          )
            ? [resume, ...state.offlineResumes]
            : state.offlineResumes,
      }))
    },
  }
}
