import type { ShareSlice, ShareUiSlice } from './types'

export const createShareUiSlice: ShareSlice<ShareUiSlice> = (set, get) => ({
  openForResumeId: null,
  openForResumeName: null,
  searchKeyword: '',
  resumeFilters: [],
  statusFilter: 'all',
  actionShare: null,
  actionTrigger: null,

  openDialog: (resumeId, resumeName) => {
    set({
      openForResumeId: resumeId,
      openForResumeName: resumeName,
      shares: [],
      loading: true,
      mutatingId: null,
      error: null,
    })
    get().loadShares(resumeId).catch(() => undefined)
  },

  closeDialog: () => set({
    openForResumeId: null,
    openForResumeName: null,
    shares: [],
    loading: false,
    mutatingId: null,
    error: null,
  }),

  setSearchKeyword: searchKeyword => set({ searchKeyword }),
  setResumeFilters: resumeFilters => set({ resumeFilters }),
  setStatusFilter: statusFilter => set({ statusFilter }),
  setActionShare: (actionShare, actionTrigger = null) => set({
    actionShare,
    actionTrigger,
  }),
})
