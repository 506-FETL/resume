import type { HistoryDataSlice } from './history-data/types'
import type { HistoryUiSlice } from './history-ui'
import type { HistoryJobOptionsSlice } from './job-options'

export type HistoryStoreState = HistoryDataSlice &
  HistoryUiSlice &
  HistoryJobOptionsSlice
