import type { HistoryStoreState } from './types'
import { create } from 'zustand'
import { createHistoryDataSlice } from './history-data'
import { createHistoryUiSlice } from './history-ui'

const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
  ...createHistoryDataSlice(set, get),
  ...createHistoryUiSlice(set),
}))

export default useHistoryStore

export type { HistoryStoreState } from './types'
