import type { StoreApi } from 'zustand'
import type { HistoryStoreState } from './types'
import type { JobOptionSummary } from '@/lib/supabase/resume/company'

interface JobOptionsResource {
  items: JobOptionSummary[]
  loading: boolean
  error: string | null
}

export interface HistoryJobOptionsSlice {
  jobOptions: Record<string, JobOptionsResource | undefined>
  loadJobOptions: (companyId: string) => Promise<void>
  resetJobOptions: () => void
}

export function createHistoryJobOptionsSlice(
  set: StoreApi<HistoryStoreState>['setState'],
  get: StoreApi<HistoryStoreState>['getState'],
): HistoryJobOptionsSlice {
  const pending = new Map<string, Promise<void>>()
  let generation = 0

  return {
    jobOptions: {},
    resetJobOptions() {
      generation += 1
      pending.clear()
      set({ jobOptions: {} })
    },
    loadJobOptions(companyId) {
      const active = pending.get(companyId)
      const previous = get().jobOptions[companyId]

      if (active) return active
      if (previous && !previous.error) return Promise.resolve()

      const scope = generation

      const write = (resource: JobOptionsResource) => {
        if (scope === generation)
          set((state) => ({
            jobOptions: { ...state.jobOptions, [companyId]: resource },
          }))
      }

      write({ items: [], loading: true, error: null })

      const request = import('@/lib/supabase/resume/company/queries')
        .then(({ listJobOptions }) => listJobOptions(companyId))
        .then(
          (items) => write({ items, loading: false, error: null }),
          (error: unknown) =>
            write({
              items: [],
              loading: false,
              error:
                error instanceof Error ? error.message : '岗位信息加载失败',
            }),
        )
        .finally(() => {
          if (pending.get(companyId) === request) pending.delete(companyId)
        })

      pending.set(companyId, request)

      return request
    },
  }
}
