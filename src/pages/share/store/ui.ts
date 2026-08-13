import type { ShareSlice, ShareUiSlice } from './types'

export const createShareUiSlice: ShareSlice<ShareUiSlice> = (set, get) => ({
  openForResumeId: null,
  openForResumeName: null,
  searchKeyword: '',
  resumeFilters: [],
  statusFilter: 'all',
  settingsDialogOpen: false,
  settingsShareId: null,
  archiveDialogOpen: false,
  archiveShareId: null,
  deleteDialogOpen: false,
  deleteShareId: null,
  versionDialogOpen: false,
  versionShareId: null,

  openDialog: (resumeId, resumeName) => {
    const requestId = get().dialogRequestId + 1
    set({
      openForResumeId: resumeId,
      openForResumeName: resumeName,
      dialogRequestId: requestId,
      shares: [],
      dialogLoading: true,
      dialogError: null,
    })
    get().loadDialogShares(resumeId).catch(() => undefined)
    get().loadVersionOptions(resumeId, { force: true }).catch(() => undefined)
  },

  closeDialog: () => set(state => ({
    openForResumeId: null,
    openForResumeName: null,
    dialogRequestId: state.dialogRequestId + 1,
    shares: [],
    dialogLoading: false,
    dialogError: null,
  })),

  setSearchKeyword: searchKeyword => set({ searchKeyword }),
  setResumeFilters: resumeFilters => set({ resumeFilters }),
  setStatusFilter: statusFilter => set({ statusFilter }),
  openSettingsDialog: settingsShareId => set({
    settingsShareId,
    settingsDialogOpen: true,
  }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  openArchiveDialog: archiveShareId => set({
    archiveShareId,
    archiveDialogOpen: true,
  }),
  closeArchiveDialog: () => set({ archiveDialogOpen: false }),
  openDeleteDialog: deleteShareId => set({
    deleteShareId,
    deleteDialogOpen: true,
  }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
  openVersionDialog: versionShareId => set({
    versionShareId,
    versionDialogOpen: true,
  }),
  closeVersionDialog: () => set({ versionDialogOpen: false }),
})
