import type { StoreApi } from 'zustand'
import type { HistorySelection } from '../types'
import type { HistoryStoreState } from './types'

export interface HistoryUiSlice {
  mobilePanel: 'timeline' | 'detail'
  timelineFocusTarget: HistorySelection
  showDetail: () => void
  showTimeline: (target: HistorySelection) => void
  clearTimelineFocus: () => void
  loading: boolean
  savingCurrent: boolean
  savingMetadata: boolean
  restoring: boolean
  deletingVersionId: number | null
}

type Set = StoreApi<HistoryStoreState>['setState']

export function createHistoryUiSlice(set: Set): HistoryUiSlice {
  return {
    mobilePanel: 'timeline',
    timelineFocusTarget: null,
    showDetail: () => set({ mobilePanel: 'detail', timelineFocusTarget: null }),
    showTimeline: (target) =>
      set({ mobilePanel: 'timeline', timelineFocusTarget: target }),
    clearTimelineFocus: () => set({ timelineFocusTarget: null }),
    loading: false,
    savingCurrent: false,
    savingMetadata: false,
    restoring: false,
    deletingVersionId: null,
  }
}
