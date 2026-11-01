import type { ResumeListState } from './types'
import { create } from 'zustand'
import { createResumeListSlice } from './resume-list'
import { createResumeSyncSlice } from './resume-sync'
import { createResumeUiSlice } from './resume-ui'
import { createTemplateNamesSlice } from './template-names'
import { createResumeLibrarySlice } from './library'
import useUserStore from '@/store/user'

const useResumeListStore = create<ResumeListState>()((set, get) => ({
  ...createResumeListSlice(set, get),
  ...createResumeSyncSlice(set, get),
  ...createResumeUiSlice(set),
  ...createTemplateNamesSlice(set, get),
  ...createResumeLibrarySlice(set, get),
  libraryAccountId: useUserStore.getState().currentUser?.id ?? null,
}))

useUserStore.subscribe((state, previous) => {
  const accountId = state.currentUser?.id ?? null

  if (accountId === (previous.currentUser?.id ?? null)) return

  const store = useResumeListStore.getState()

  store.cancelLoad()
  store.resetLibraryAccount(accountId)

  useResumeListStore.setState({
    accountId,
    resumes: [],
    offlineResumes: [],
    loading: true,
    loadError: null,
    syncingIds: new Set(),
    isSyncing: false,
    showSyncDialog: false,
    derivePendingFor: null,
    derivedJobsOpen: false,
    _localDeletingIds: new Set(),
  })
})

export default useResumeListStore

export type { ResumeListState } from './types'
