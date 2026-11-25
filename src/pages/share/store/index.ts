import type { ShareStoreState } from './types'
import useUserStore from '@/store/user'
import { create } from 'zustand'
import { clearManagementCache } from './data/management'
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
  clearManagementCache()

  useShareStore.setState((current) => ({
    pageNumber: 1,
    pageQueryKey: null,
    pageKeyword: '',
    pageStats: null,
    countScope: null,
    statusCounts: null,
    overview: null,
    statsLoading: true,
    statsError: null,
    pageRequestId: current.pageRequestId + 1,
    dialogRequestId: current.dialogRequestId + 1,
    shares: [],
    pageShares: [],
    pendingShareIds: [],
    resumeMap: {},
    searchKeyword: '',
    resumeFilters: [],
    statusFilter: 'all',
    versionOptionsByResumeId: {},
    pageLoading: true,
    pageError: null,
    pageLoaded: false,
    resumeOptionsLoading: true,
    resumeOptionsError: null,
    resumeOptionsLoaded: false,
    dialogLoading: false,
    dialogError: null,
    settingsDialogOpen: false,
    settingsShareId: null,
    archiveDialogOpen: false,
    archiveShareId: null,
    deleteDialogOpen: false,
    deleteShareId: null,
    versionDialogOpen: false,
    versionShareId: null,
    openForResumeId: null,
    openForResumeName: null,
  }))
})

export default useShareStore
