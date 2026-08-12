import type { StateCreator } from 'zustand'
import type { ResumeSummary } from '../types'
import type { ShareStatusFilter } from '../utils'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface SettingsPayload {
  label: string | null
  expiresAt: string | null
  password: string | null | undefined
}

export interface ShareDataSlice {
  ownerUserId: string | null
  pageRequestId: number
  shares: ResumeShareRecord[]
  allShares: ResumeShareRecord[]
  resumeMap: Record<string, ResumeSummary>
  loading: boolean
  pageLoading: boolean
  mutatingId: string | null
  error: string | null

  bootstrapPage: () => Promise<void>
  reloadPage: () => Promise<void>
  loadShares: (resumeId: string) => Promise<void>
  create: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
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
  remove: (shareId: string) => Promise<void>
}

export interface ShareUiSlice {
  openForResumeId: string | null
  openForResumeName: string | null
  searchKeyword: string
  resumeFilters: string[]
  statusFilter: ShareStatusFilter
  actionShare: ResumeShareRecord | null
  actionTrigger: HTMLElement | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  setSearchKeyword: (value: string) => void
  setResumeFilters: (value: string[]) => void
  setStatusFilter: (value: ShareStatusFilter) => void
  setActionShare: (
    share: ResumeShareRecord | null,
    trigger?: HTMLElement | null,
  ) => void
}

export type ShareStoreState = ShareDataSlice & ShareUiSlice
export type ShareSlice<T> = StateCreator<ShareStoreState, [], [], T>
