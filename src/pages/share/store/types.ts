import type {
  ShareManagementCounts,
  ShareGroup,
} from '@/lib/supabase/resume/share/management'
import type { StateCreator } from 'zustand'
import type { ShareStatusFilter } from '../utils'
import type { ShareResumeOption } from '@/lib/supabase/resume/share/option-pages'
import type {
  CreateShareOptions,
  CreateShareReleaseSource,
  ResolvedResumeShareRelease,
  ResumeShareRecord,
} from '@/lib/supabase/resume/share.types'

export interface SettingsPayload {
  showPhone?: boolean
  showEmail?: boolean
  label: string | null
  expiresAt: string | null
  password: string | null | undefined
  allowComments: boolean
}

export interface ShareDataSlice {
  statsRequestId: number
  pageRequestId: number
  pageNumber: number
  pageQueryKey: string | null
  pageKeyword: string
  managementOpen: boolean
  pageStats: ShareManagementCounts | null
  countScope: string | null
  statusCounts: ShareManagementCounts['counts'] | null
  overview: ShareManagementCounts['overview'] | null
  statsError: string | null
  statsLoading: boolean
  shares: ResumeShareRecord[]
  pageShares: ResumeShareRecord[]
  pageGroups: Record<string, ShareGroup>
  pageTotal: number | null
  pageLoading: boolean
  pageError: string | null
  pageLoaded: boolean
  dialogLoading: boolean
  dialogError: string | null
  dialogRequestId: number
  pendingShareIds: string[]

  bootstrapPage: () => Promise<void>
  leaveManagement: () => void
  invalidateManagement: (refresh?: { cards?: boolean; stats?: boolean }) => void
  setPageNumber: (page: number) => void
  setPageKeyword: (keyword: string) => void
  reloadManagementStats: () => Promise<void>
  reloadManagementCards: () => Promise<void>
  reloadPage: () => Promise<void>
  loadDialogShares: (resumeId: string) => Promise<void>
  createRelease: (
    resumeId: string,
    release: CreateShareReleaseSource,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  updateSettings: (shareId: string, settings: SettingsPayload) => Promise<void>
  publishRelease: (
    shareId: string,
    release: ResolvedResumeShareRelease,
  ) => Promise<void>
  archive: (shareId: string) => Promise<void>
  remove: (shareId: string) => Promise<void>
}

export interface ShareUiSlice {
  createDialogOpen: boolean
  setCreateDialogOpen: (open: boolean) => void
  openForResumeId: string | null
  openForResumeName: string | null
  searchKeyword: string
  resumeFilters: string[]
  resumeFilterNames: Record<string, string>
  statusFilter: ShareStatusFilter
  settingsDialogOpen: boolean
  settingsShareId: string | null
  archiveDialogOpen: boolean
  archiveShareId: string | null
  deleteDialogOpen: boolean
  deleteShareId: string | null
  versionDialogOpen: boolean
  versionShareId: string | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  setSearchKeyword: (value: string) => void
  setResumeFilters: (value: string[], option?: ShareResumeOption) => void
  setStatusFilter: (value: ShareStatusFilter) => void
  resetFilters: () => void
  openSettingsDialog: (shareId: string) => void
  closeSettingsDialog: () => void
  openArchiveDialog: (shareId: string) => void
  closeArchiveDialog: () => void
  openDeleteDialog: (shareId: string) => void
  closeDeleteDialog: () => void
  openVersionDialog: (shareId: string) => void
  closeVersionDialog: () => void
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice

export type ShareSlice<T> = StateCreator<ShareStoreState, [], [], T>
