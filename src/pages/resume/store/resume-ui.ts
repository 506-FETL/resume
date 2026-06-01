import type { StoreApi } from 'zustand'
import type { ResumeListState } from './types'

export type ResumeFilterMode = 'all' | 'roots' | 'variants'

export interface ResumeUiSlice {
  showSyncDialog: boolean
  setShowSyncDialog: (show: boolean) => void
  filterMode: ResumeFilterMode
  setFilterMode: (mode: ResumeFilterMode) => void
  derivePendingFor: string | null
  openDeriveFor: (id: string | null) => void
  derivedJobsOpen: boolean
  setDerivedJobsOpen: (open: boolean) => void
}

type Set = StoreApi<ResumeListState>['setState']

export function createResumeUiSlice(set: Set): ResumeUiSlice {
  return {
    showSyncDialog: false,
    setShowSyncDialog: show => set({ showSyncDialog: show }),
    filterMode: 'all',
    setFilterMode: mode => set({ filterMode: mode }),
    derivePendingFor: null,
    openDeriveFor: id => set({ derivePendingFor: id }),
    derivedJobsOpen: false,
    setDerivedJobsOpen: open => set({ derivedJobsOpen: open }),
  }
}
