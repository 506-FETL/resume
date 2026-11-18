import { RESUME_TYPES, type ResumeType } from './resume-type'
import type { ResumeTemplateBinding } from './persisted'
import type { DerivedStatus, VariantMetadata } from './variant'

import { z } from 'zod'

export * from './config'

export {
  DEFAULT_ORDER,
  LEGACY_KEY_MAP,
  migrateOrder,
  migrateVisibility,
  resumeSchema,
} from './form'

export type { ORDERType, ResumeSchema, VisibilityItemsType } from './form'

// 模板类型
export const resumeTypeEnum = z.enum(RESUME_TYPES)

export type { ResumeType } from './resume-type'

export { normalizeResumeType } from './resume-type'

// 简历列表
export interface ResumeListItem {
  templateBinding?: ResumeTemplateBinding | null
  resume_id: string
  created_at: string
  updated_at?: string
  type: ResumeType
  display_name?: string
  description?: string
  isOffline?: boolean
  parent_resume_id?: string | null
  linked_jd_excerpt?: string | null
  linked_jd_text?: string | null
  derived_metadata?: VariantMetadata | null
  derived_match_rate?: number | null
  derived_status?: DerivedStatus | null
}

export * from './form'

export * from './normalize'

export * from './persisted'

export type { ResumeTemplateBinding } from './persisted'

export * from './variant'

export * from './visibility'
