import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'

export interface ResumeShareSnapshotSource {
  snapshot: PersistedResumeSnapshot
  templateManifest: TemplateManifest
  displayName: string | null
}

export type ShareVersionSelection
  = | { kind: 'current' }
    | { kind: 'history', versionId: number }

export type ShareVersionSource
  = | { kind: 'current' }
    | {
      kind: 'history'
      versionId: number | null
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }

export type ResolvedShareVersionSource
  = | { kind: 'current' }
    | {
      kind: 'history'
      versionId: number
      versionNo: number
      versionLabel: string
      versionCreatedAt: string
    }

export interface ResolvedResumeShareRelease extends ResumeShareSnapshotSource {
  source: ResolvedShareVersionSource
}

export interface ResumeShareReleaseSummary {
  id: string
  releaseNo: number
  displayName: string | null
  source: ShareVersionSource
  createdAt: string
}

export type CurrentResumeShareSnapshotProvider
  = (resumeId: string) => Promise<ResumeShareSnapshotSource>

export interface ResumeShareVersionSourceColumns {
  source_kind: 'current' | 'history'
  source_version_id: number | null
  source_version_no: number | null
  source_version_label: string | null
  source_version_created_at: string | null
}

/** resume_shares 表行（owner 侧可见字段，不包含 password_hash） */
export interface ResumeShareRecord {
  id: string
  resume_id: string
  user_id: string
  token: string
  label: string | null
  display_name: string | null
  is_active: boolean
  /** 是否设了密码（owner 侧只需知道有无，不需要 hash 本身） */
  has_password: boolean
  expires_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
  updated_at: string
  currentReleaseId: string
  currentRelease: ResumeShareReleaseSummary
  allowComments: boolean
  archivedAt: string | null
  source: ShareVersionSource
}

/** 新建分享链接的可选项 */
export interface CreateShareOptions {
  label?: string | null
  password?: string | null
  expiresAt?: string | null
}

/** 匿名访问分享页的读取结果 */
export interface ShareViewResult {
  needPassword?: boolean
  wrongPassword?: boolean
  rateLimited?: boolean
  snapshot?: PersistedResumeSnapshot
  templateManifest?: TemplateManifest
  displayName?: string | null
  shareId?: string
  releaseId?: string
  releaseNo?: number
  allowComments?: boolean
  projectionReferenceDate?: string
  commentScopeId?: string
  commentAccessToken?: string
  commentAccessExpiresAt?: string
  unavailable?: boolean
}
