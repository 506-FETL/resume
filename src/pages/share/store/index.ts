import type { ShareStoreState } from './types'
import { create } from 'zustand'
import { createShareDataSlice } from './data'
import { createShareUiSlice } from './ui'

const useShareStore = create<ShareStoreState>()((...args) => ({
  ...createShareDataSlice(...args),
  ...createShareUiSlice(...args),
}))

export default useShareStore
