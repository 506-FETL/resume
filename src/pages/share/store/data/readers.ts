import { getResumeOptions } from '@/lib/supabase/resume/summaries'
import { listResumeShares } from '@/lib/supabase/resume/share/records'
import type { ShareDataSlice, ShareSlice } from '../types'
import {
  dialogShareRequests,
  shareReadGeneration,
  versionOptionRequests,
} from './requests'

export const createShareReaders: ShareSlice<
  Pick<
    ShareDataSlice,
    'reloadResumeOptions' | 'loadDialogShares' | 'loadVersionOptions'
  >
> = (set, get) => {
  let optionsRequest: { generation: number; task: Promise<void> } | null = null

  return {
    reloadResumeOptions: async () => {
      const generation = shareReadGeneration

      if (optionsRequest?.generation === generation) return optionsRequest.task

      set({ resumeOptionsLoading: true, resumeOptionsError: null })

      const task = (async () => {
        try {
          const resumes = await getResumeOptions()

          if (generation !== shareReadGeneration) return

          set({
            resumeMap: Object.fromEntries(
              resumes.map((resume) => [
                resume.resume_id,
                {
                  resumeId: resume.resume_id,
                  displayName: resume.display_name || '未命名简历',
                  type: resume.type,
                },
              ]),
            ),
            resumeOptionsLoaded: true,
          })
        } catch (error) {
          if (generation === shareReadGeneration)
            set({
              resumeOptionsError:
                error instanceof Error ? error.message : '简历列表加载失败',
            })
        } finally {
          if (generation === shareReadGeneration)
            set({ resumeOptionsLoading: false })
        }
      })()

      optionsRequest = { generation, task }

      try {
        await task
      } finally {
        if (optionsRequest?.task === task) optionsRequest = null
      }
    },
    loadDialogShares: async (resumeId) => {
      const requestId = get().dialogRequestId

      set({
        dialogLoading: true,
        dialogError: null,
      })

      const request =
        dialogShareRequests.get(resumeId) ?? listResumeShares(resumeId)

      dialogShareRequests.set(resumeId, request)

      try {
        const shares = await request

        if (
          get().dialogRequestId === requestId &&
          get().openForResumeId === resumeId
        ) {
          set({
            shares,
            dialogLoading: false,
          })
        }
      } catch (error) {
        if (
          get().dialogRequestId === requestId &&
          get().openForResumeId === resumeId
        ) {
          set({
            dialogLoading: false,
            dialogError: error instanceof Error ? error.message : '加载失败',
          })
        }
      } finally {
        if (dialogShareRequests.get(resumeId) === request)
          dialogShareRequests.delete(resumeId)
      }
    },
    loadVersionOptions: async (resumeId, options) => {
      const activeRequest = versionOptionRequests.get(resumeId)

      if (activeRequest) return activeRequest

      const generation = shareReadGeneration
      const current = get().versionOptionsByResumeId[resumeId]

      if (current?.loaded && !options?.force) return

      const requestId = (current?.requestId ?? 0) + 1

      set((state) => ({
        versionOptionsByResumeId: {
          ...state.versionOptionsByResumeId,
          [resumeId]: {
            items: current?.items ?? [],
            loading: true,
            error: null,
            requestId,
            loaded: current?.loaded ?? false,
          },
        },
      }))

      const request = (async () => {
        try {
          const { listResumeHistoryShareOptions } =
            await import('@/lib/supabase/resume/history/queries/resumes')

          const items = await listResumeHistoryShareOptions(resumeId)

          if (
            shareReadGeneration !== generation ||
            get().versionOptionsByResumeId[resumeId]?.requestId !== requestId
          )
            return

          set((state) => ({
            versionOptionsByResumeId: {
              ...state.versionOptionsByResumeId,
              [resumeId]: {
                items,
                loading: false,
                error: null,
                requestId,
                loaded: true,
              },
            },
          }))
        } catch (error) {
          if (
            shareReadGeneration !== generation ||
            get().versionOptionsByResumeId[resumeId]?.requestId !== requestId
          )
            return

          set((state) => ({
            versionOptionsByResumeId: {
              ...state.versionOptionsByResumeId,
              [resumeId]: {
                items: state.versionOptionsByResumeId[resumeId]?.items ?? [],
                loading: false,
                error:
                  error instanceof Error ? error.message : '历史版本加载失败',
                requestId,
                loaded:
                  state.versionOptionsByResumeId[resumeId]?.loaded ?? false,
              },
            },
          }))
        }
      })()

      versionOptionRequests.set(resumeId, request)

      try {
        await request
      } finally {
        if (versionOptionRequests.get(resumeId) === request)
          versionOptionRequests.delete(resumeId)
      }
    },
  }
}
