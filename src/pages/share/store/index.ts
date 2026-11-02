import type { ShareStoreState } from './types'
import useUserStore from '@/store/user'
import { create } from 'zustand'
import { clearShareReadRequests, createShareDataSlice } from './data'
import { createShareUiSlice } from './ui'

const useShareStore = create<ShareStoreState>()((...args) => ({
  ...createShareDataSlice(...args),
  ...createShareUiSlice(...args),
}))

let accountId = useUserStore.getState().currentUser?.id ?? null

useUserStore.subscribe((state) => {
  const nextAccountId = state.currentUser?.id ?? null

  if (accountId === nextAccountId) return

  accountId = nextAccountId
  clearShareReadRequests()

  useShareStore.setState((current) => ({
    ownerUserId: null,
    pageRequestId: current.pageRequestId + 1,
    dialogRequestId: current.dialogRequestId + 1,
    shares: [],
    allShares: [],
    pendingShareIds: [],
    resumeMap: {},
    searchKeyword: '',
    resumeFilters: [],
    statusFilter: 'all',
    versionOptionsByResumeId: {},
    pageLoading: true,
    pageError: null,
    dialogLoading: false,
    dialogError: null,
    openForResumeId: null,
    openForResumeName: null,
  }))
})

export default useShareStore
