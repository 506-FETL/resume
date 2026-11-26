import type { ShareSlice, ShareUiSlice } from './types'
import { invalidateShareVersionPages } from './data/option-pages'

export const createShareUiSlice: ShareSlice<ShareUiSlice> = (set, get) => ({
  createDialogOpen: false,
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),
  openForResumeId: null,
  openForResumeName: null,
  searchKeyword: '',
  resumeFilters: [],
  resumeFilterNames: {},
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

    invalidateShareVersionPages(resumeId)

    set({
      openForResumeId: resumeId,
      openForResumeName: resumeName,
      dialogRequestId: requestId,
      shares: [],
      dialogLoading: true,
      dialogError: null,
    })

    get()
      .loadDialogShares(resumeId)
      .catch(() => undefined)
  },

  closeDialog: () =>
    set((state) => ({
      openForResumeId: null,
      openForResumeName: null,
      dialogRequestId: state.dialogRequestId + 1,
      shares: [],
      dialogLoading: false,
      dialogError: null,
    })),

  setSearchKeyword: (searchKeyword) => {
    set({ searchKeyword })

    if (!searchKeyword.trim()) get().setPageKeyword('')
  },
  setResumeFilters: (resumeFilters, option) => {
    const names = get().resumeFilterNames

    const resumeFilterNames = Object.fromEntries(
      resumeFilters.map((id) => [
        id,
        id === option?.resume_id ? option.display_name : names[id],
      ]),
    )

    set({ resumeFilters, resumeFilterNames, pageNumber: 1 })
    get().reloadPage()
  },
  setStatusFilter: (statusFilter) => {
    if (statusFilter === get().statusFilter) return

    set({ statusFilter, pageNumber: 1 })
    get().reloadPage()
  },
  resetFilters: () => {
    set({
      searchKeyword: '',
      pageKeyword: '',
      resumeFilters: [],
      resumeFilterNames: {},
      statusFilter: 'all',
      pageNumber: 1,
    })

    get().reloadPage()
  },
  openSettingsDialog: (settingsShareId) =>
    set({
      settingsShareId,
      settingsDialogOpen: true,
    }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  openArchiveDialog: (archiveShareId) =>
    set({
      archiveShareId,
      archiveDialogOpen: true,
    }),
  closeArchiveDialog: () => set({ archiveDialogOpen: false }),
  openDeleteDialog: (deleteShareId) =>
    set({
      deleteShareId,
      deleteDialogOpen: true,
    }),
  closeDeleteDialog: () => set({ deleteDialogOpen: false }),
  openVersionDialog: (versionShareId) =>
    set({
      versionShareId,
      versionDialogOpen: true,
    }),
  closeVersionDialog: () => set({ versionDialogOpen: false }),
})
