import type { StateCreator } from 'zustand'
import type { ResumeSummary } from '../types'
import type { ShareStatusFilter } from '../utils'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { CreateShareOptions, ResolvedResumeShareRelease, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface SettingsPayload {
  label: string | null
  expiresAt: string | null
  password: string | null | undefined
}

export interface VersionOptionsEntry {
  items: ResumeHistoryVersionListItem[]
  loading: boolean
  error: string | null
  requestId: number
  loaded: boolean
}

export interface ShareDataSlice {
  ownerUserId: string | null
  pageRequestId: number
  shares: ResumeShareRecord[]
  allShares: ResumeShareRecord[]
  resumeMap: Record<string, ResumeSummary>
  pageLoading: boolean
  pageError: string | null
  dialogLoading: boolean
  dialogError: string | null
  dialogRequestId: number
  pendingShareIds: string[]
  versionOptionsByResumeId: Record<string, VersionOptionsEntry>

  bootstrapPage: () => Promise<void>
  reloadPage: () => Promise<void>
  loadDialogShares: (resumeId: string) => Promise<void>
  loadVersionOptions: (
    resumeId: string,
    options?: { force?: boolean },
  ) => Promise<void>
  createRelease: (
    resumeId: string,
    release: ResolvedResumeShareRelease,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  updateSettings: (shareId: string, settings: SettingsPayload) => Promise<void>
  pushSnapshot: (
    shareId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
  ) => Promise<void>
  publishRelease: (
    shareId: string,
    release: ResolvedResumeShareRelease,
  ) => Promise<void>
  remove: (shareId: string) => Promise<void>
}

export interface ShareUiSlice {
  openForResumeId: string | null
  openForResumeName: string | null
  searchKeyword: string
  resumeFilters: string[]
  statusFilter: ShareStatusFilter
  settingsDialogOpen: boolean
  settingsShareId: string | null
  deleteDialogOpen: boolean
  deleteShareId: string | null
  versionDialogOpen: boolean
  versionShareId: string | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  setSearchKeyword: (value: string) => void
  setResumeFilters: (value: string[]) => void
  setStatusFilter: (value: ShareStatusFilter) => void
  openSettingsDialog: (shareId: string) => void
  closeSettingsDialog: () => void
  openDeleteDialog: (shareId: string) => void
  closeDeleteDialog: () => void
  openVersionDialog: (shareId: string) => void
  closeVersionDialog: () => void
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice
export type ShareSlice<T> = StateCreator<ShareStoreState, [], [], T>
