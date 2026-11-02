import type { StoreApi } from 'zustand'
import type { HistoryStoreState } from './types'
import type { JobOptionSummary } from '@/lib/supabase/resume/company'
import { listJobOptions } from '@/lib/supabase/resume/company'

export interface HistoryJobOptionsSlice {
  jobOptions: JobOptionSummary[]
  jobOptionsLoading: boolean
  jobOptionsError: string | null
  jobOptionsGeneration: number
  loadJobOptions: () => Promise<void>
  resetJobOptions: () => void
}

export function createHistoryJobOptionsSlice(
  set: StoreApi<HistoryStoreState>['setState'],
  get: StoreApi<HistoryStoreState>['getState'],
): HistoryJobOptionsSlice {
  let loaded = false
  let pending: Promise<void> | null = null

  return {
    jobOptions: [],
    jobOptionsLoading: true,
    jobOptionsError: null,
    jobOptionsGeneration: 0,

    resetJobOptions() {
      loaded = false
      pending = null

      set((state) => ({
        jobOptions: [],
        jobOptionsLoading: true,
        jobOptionsError: null,
        jobOptionsGeneration: state.jobOptionsGeneration + 1,
      }))
    },

    loadJobOptions() {
      if (pending) return pending
      if (loaded) return Promise.resolve()

      const generation = get().jobOptionsGeneration
      const current = () => generation === get().jobOptionsGeneration

      set({ jobOptionsLoading: true, jobOptionsError: null })

      const request = listJobOptions()
        .then((jobOptions) => {
          if (!current()) return

          loaded = true
          set({ jobOptions })
        })
        .catch((error: unknown) => {
          if (current())
            set({
              jobOptionsError:
                error instanceof Error ? error.message : '岗位列表加载失败',
            })
        })
        .finally(() => {
          if (current()) set({ jobOptionsLoading: false })
          if (pending === request) pending = null
        })

      pending = request

      return request
    },
  }
}
