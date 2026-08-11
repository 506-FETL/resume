import type { TemplateManifest } from '@/lib/resume-template/schema'
import type { PersistedResumeSnapshot } from '@/lib/schema'

export interface ResumeShareSnapshotSource {
  snapshot: PersistedResumeSnapshot
  templateManifest: TemplateManifest
  displayName: string | null
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
  unavailable?: boolean
}
