import type { ShareSlice, ShareUiSlice } from './types'

export const createShareUiSlice: ShareSlice<ShareUiSlice> = (set, get) => ({
  openForResumeId: null,
  openForResumeName: null,
  searchKeyword: '',
  resumeFilters: [],
  statusFilter: 'all',
  actionShare: null,
  actionTrigger: null,
  settingsDialogOpen: false,
  settingsShareId: null,
  deleteDialogOpen: false,
  deleteShareId: null,

  openDialog: (resumeId, resumeName) => {
    const requestId = get().dialogRequestId + 1
    set({
      openForResumeId: resumeId,
      openForResumeName: resumeName,
      dialogRequestId: requestId,
      shares: [],
      loading: true,
      dialogLoading: true,
      mutatingId: null,
      error: null,
      dialogError: null,
    })
    get().loadDialogShares(resumeId).catch(() => undefined)
  },

  closeDialog: () => set(state => ({
    openForResumeId: null,
    openForResumeName: null,
    dialogRequestId: state.dialogRequestId + 1,
    shares: [],
    loading: false,
    dialogLoading: false,
    mutatingId: null,
    error: null,
    dialogError: null,
  })),

  setSearchKeyword: searchKeyword => set({ searchKeyword }),
  setResumeFilters: resumeFilters => set({ resumeFilters }),
  setStatusFilter: statusFilter => set({ statusFilter }),
  setActionShare: (actionShare, actionTrigger = null) => set({
    actionShare,
    actionTrigger,
  }),
  openSettingsDialog: settingsShareId => set({
    settingsShareId,
    settingsDialogOpen: true,
  }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  openDeleteDialog: deleteShareId => set({
    deleteShareId,
    deleteDialogOpen: true,
  }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
})
