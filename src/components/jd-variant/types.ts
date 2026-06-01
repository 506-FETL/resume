import type { LucideIcon } from 'lucide-react'
import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  ResumeSchema,
  VariantChange,
  VariantMetadata,
} from '@/lib/schema'
import type { VariantLineage, VariantTreeNode } from '@/lib/supabase/resume/variant'

export type { DerivedStatus, VariantChange, VariantLineage, VariantMetadata, VariantTreeNode }

export type GeneratorPhase
  = | 'idle'
    | 'parsing'
    | 'rewriting'
    | 'success'
    | 'error'
    | 'aborted'

export interface VariantAnalysisLog {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface GeneratorState {
  phase: GeneratorPhase
  draftResumeId: string | null
  keywords: string[]
  changes: VariantChange[]
  completedSections: Array<keyof ResumeSchema>
  errorMessage: string | null
  matchRate: number
  parseReasoning: string
  rewriteReasoning: string
  rewriteContent: string
  logs: VariantAnalysisLog[]
}

export interface GenerateVariantArgs {
  parentResumeId: string
  jdText: string
  reuseKeywords?: string[]
}

export interface VariantStepConfig {
  id: 'parsing' | 'thinking' | 'cloning' | 'rewriting' | 'validating' | 'done'
  label: string
  icon: LucideIcon
}

export type ResumeFilterMode = 'all' | 'originals' | 'variants'

/** 给 LLM 喂的简历视图，仅含白名单字段 */
export type EditableResumeView = Partial<{
  basics: { id: 'whole', summary?: string }
  job_intent: { id: 'whole', content?: string }
  skill_specialty: { id: 'whole', content?: string }
  self_evaluation: { id: 'whole', content?: string }
  work_experience: Array<{ id: string, description?: string, bullets?: string[] }>
  internship_experience: Array<{ id: string, description?: string, bullets?: string[] }>
  project_experience: Array<{ id: string, description?: string, techStack?: string }>
  campus_experience: Array<{ id: string, description?: string }>
}>

export interface VariantApplyContext {
  snapshot: PersistedResumeSnapshot
}
