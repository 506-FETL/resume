import type { HistoryStoreState } from './types'
import useUserStore from '@/store/user'
import { create } from 'zustand'
import { createHistoryDataSlice } from './history-data'
import { createHistoryUiSlice } from './history-ui'
import { createHistoryJobOptionsSlice } from './job-options'

const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
  ...createHistoryDataSlice(set, get),
  ...createHistoryUiSlice(set),
  ...createHistoryJobOptionsSlice(set, get),
}))

useUserStore.subscribe((state, previous) => {
  useHistoryStore.getState().resetAccount(state.currentUser?.id ?? null)

  if (state.currentUser?.id !== previous.currentUser?.id)
    useHistoryStore.getState().resetJobOptions()
})

export default useHistoryStore

export type { HistoryStoreState } from './types'
