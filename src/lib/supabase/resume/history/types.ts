import type { ORDERType, PersistedResumeSnapshot, ResumeType, VisibilityFormType } from '@/lib/schema'

export type ResumeVersionSourceType
  = | 'manual'
    | 'autosave'
    | 'restore'
    | 'ai_optimize'
    | 'import'

export type RestoreStrategy = 'with_backup' | 'without_backup'

export type ResumeSnapshot = PersistedResumeSnapshot

// 版本元信息（不含 snapshot）——列表查询与 store 列表项使用
export interface ResumeHistoryVersionMeta {
  id: number
  created_at: string
  updated_at: string
  user_id: string
  resume_id: string
  version_no: number
  version_name: string | null
  description: string | null
  milestone_name: string | null
  source_type: ResumeVersionSourceType
  tags: string[] | null
  content_hash: string | null
  base_updated_at: string | null
  company_id: string | null
  submitted_at: string | null
}

// 轻量列表行（DB 返回，无 snapshot）与归一后的列表项
export type ResumeHistoryVersionListRow = ResumeHistoryVersionMeta
export type ResumeHistoryVersionListItem = ResumeHistoryVersionMeta

// 完整版本行/记录（含 snapshot）——create/update/restore 返回、按需加载后使用
export type ResumeHistoryVersionRow = ResumeHistoryVersionMeta & { snapshot: ResumeSnapshot | Record<string, unknown> }

export type ResumeHistoryVersionRecord = ResumeHistoryVersionMeta & { snapshot: ResumeSnapshot }

export interface ResumeHistoryShareReleaseRow {
  resume_id: string
  version_no: number
  version_name: string | null
  milestone_name: string | null
  created_at: string
  snapshot: ResumeSnapshot | Record<string, unknown>
}

export interface ResumeHistoryResumeRecord {
  resume_id: string
  updated_at: string | null
  display_name: string | null
  description: string | null
  type: ResumeType | null
  basics: Record<string, unknown> | null
  job_intent: Record<string, unknown> | null
  application_info: Record<string, unknown> | null
  edu_background: Record<string, unknown> | null
  work_experience: Record<string, unknown> | null
  internship_experience: Record<string, unknown> | null
  campus_experience: Record<string, unknown> | null
  project_experience: Record<string, unknown> | null
  skill_specialty: Record<string, unknown> | null
  honors_certificates: Record<string, unknown> | null
  self_evaluation: Record<string, unknown> | null
  hobbies: Record<string, unknown> | null
  order: ORDERType[] | string[] | null
  visibility: VisibilityFormType | Record<string, boolean> | null
  spacing: Record<string, unknown> | null
  font: Record<string, unknown> | null
  theme: Record<string, unknown> | null
}

export interface ResumeHistoryOptionRecord {
  resume_id: string
  updated_at: string | null
  display_name: string | null
  description: string | null
  type: ResumeType | null
}

export interface ResumeHistoryVersionSummaryRecord {
  resume_id: string
  version_no: number
  created_at: string
  source_type: ResumeVersionSourceType
  milestone_name: string | null
}

export interface CreateResumeHistoryVersionInput {
  resume_id: string
  version_name?: string | null
  description?: string | null
  milestone_name?: string | null
  source_type?: ResumeVersionSourceType
  tags?: string[]
  snapshot: ResumeSnapshot | Record<string, unknown>
  content_hash?: string | null
  base_updated_at?: string | null
  company_id?: string | null
  submitted_at?: string | null
}

export interface UpdateResumeHistoryVersionInput {
  version_name?: string | null
  description?: string | null
  milestone_name?: string | null
  tags?: string[]
  company_id?: string | null
  submitted_at?: string | null
}

export interface RestoreResumeHistoryVersionInput {
  resumeId: string
  targetVersion: ResumeHistoryVersionListItem
  targetSnapshot: ResumeSnapshot
  currentSnapshot: ResumeSnapshot
  currentUpdatedAt: string | null
  strategy: RestoreStrategy
}
