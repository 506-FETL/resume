import type { StoreApi } from 'zustand'
import type { AccessibleResumeListItem } from '@/lib/resume-access'
import { listAccessibleResumes } from '@/lib/resume-access'
import { getErrorMessage } from '@/utils'

interface ResumeOptionsState {
  resumeOptions: AccessibleResumeListItem[]
  resumeOptionsLoading: boolean
  resumeOptionsError: string | null
  resumeOptionsRevision: number
}

export function createAtsResumeOptions(
  set: StoreApi<ResumeOptionsState>['setState'],
) {
  let generation = 0
  let request: Promise<void> | null = null

  return {
    resumeOptions: [] as AccessibleResumeListItem[],
    resumeOptionsRevision: 0,
    resumeOptionsLoading: true,
    resumeOptionsError: null as string | null,
    loadResumeOptions: (): Promise<void> => {
      if (request) return request

      const scope = generation

      set({ resumeOptionsLoading: true, resumeOptionsError: null })

      const pending = listAccessibleResumes()
        .then((resumeOptions) => {
          if (scope === generation)
            set({ resumeOptions, resumeOptionsLoading: false })
        })
        .catch((error) => {
          if (scope === generation)
            set({
              resumeOptionsError: getErrorMessage(error, '简历列表加载失败'),
              resumeOptionsLoading: false,
            })
        })
        .finally(() => {
          if (request === pending) request = null
        })

      request = pending

      return pending
    },
    invalidateResumeOptions: () => {
      generation += 1
      request = null

      set((state) => ({
        resumeOptionsRevision: state.resumeOptionsRevision + 1,
      }))
    },
    resetResumeOptions: () => {
      generation += 1
      request = null

      set({
        resumeOptions: [],
        resumeOptionsLoading: true,
        resumeOptionsError: null,
      })
    },
  }
}
