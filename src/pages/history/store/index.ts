import type { HistoryStoreState } from './types'
import useUserStore from '@/store/user'
import { create } from 'zustand'
import { createHistoryDataSlice } from './history-data'
import { createHistoryUiSlice } from './history-ui'

const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
  ...createHistoryDataSlice(set, get),
  ...createHistoryUiSlice(set),
}))

useUserStore.subscribe((state) => {
  useHistoryStore.getState().resetAccount(state.currentUser?.id ?? null)
})

export default useHistoryStore

export type { HistoryStoreState } from './types'
