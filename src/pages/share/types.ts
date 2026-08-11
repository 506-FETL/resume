import type { ShareStatusFilter } from './utils'
import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot, ResumeType } from '@/lib/schema'
import type { CreateShareOptions, ResumeShareRecord } from '@/lib/supabase/resume/share.types'

export interface ShareResumeSummary {
  resumeId: string
  displayName: string
  type: ResumeType
}

export interface ShareState {
  /** 当前打开 ShareDialog 的简历（null = 关闭） */
  openForResumeId: string | null
  openForResumeName: string | null
  ownerUserId: string | null
  pageRequestId: number
  shares: ResumeShareRecord[]
  allShares: ResumeShareRecord[]
  resumeMap: Record<string, ShareResumeSummary>
  loading: boolean
  pageLoading: boolean
  mutatingId: string | null
  error: string | null
  searchKeyword: string
  resumeFilters: string[]
  statusFilter: ShareStatusFilter
  actionShare: ResumeShareRecord | null
  actionTrigger: HTMLElement | null

  openDialog: (resumeId: string, resumeName: string | null) => void
  closeDialog: () => void
  loadShares: (resumeId: string) => Promise<void>
  bootstrapPage: () => Promise<void>
  reloadPage: () => Promise<void>
  setSearchKeyword: (value: string) => void
  setResumeFilters: (value: string[]) => void
  setStatusFilter: (value: ShareStatusFilter) => void
  setActionShare: (share: ResumeShareRecord | null, trigger?: HTMLElement | null) => void
  create: (
    resumeId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
    options?: CreateShareOptions,
  ) => Promise<void>
  setActive: (shareId: string, isActive: boolean) => Promise<void>
  updateSettings: (
    shareId: string,
    settings: {
      label: string | null
      expiresAt: string | null
      password: string | null | undefined
    },
  ) => Promise<void>
  pushSnapshot: (
    shareId: string,
    snapshot: PersistedResumeSnapshot,
    templateManifest: TemplateManifest,
    displayName: string | null,
  ) => Promise<void>
  remove: (shareId: string) => Promise<void>
}
