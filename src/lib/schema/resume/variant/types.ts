import type { ResumeSchema } from '../form'

export type DerivedStatus = 'generating' | 'ready' | 'failed'

export interface VariantChange {
  section: keyof ResumeSchema
  /** 改写命中的子项 id；当字段为整段（如 self_evaluation）时使用字面量 `'whole'`。 */
  itemId: 'whole' | (string & {})
  fieldPath: string
  before: string
  after: string
  matchedKeywords: string[]
  reason: string
}

export interface VariantMetadata {
  keywords: string[]
  changes: VariantChange[]
  generatedAt: string
  matchRate: number
}

export interface VariantPersistedFields {
  parent_resume_id: string | null
  linked_jd_text: string | null
  derived_metadata: VariantMetadata | null
  derived_status: DerivedStatus | null
}
