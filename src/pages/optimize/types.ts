import type { ResumeSchema } from '@/lib/schema'

export interface Issue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
  impact: string
}

export interface ResumeItem {
  id: string
  name: string
  date: string
  score: number
}

// =====================
// ATS Evaluation Types (refactored)
// =====================

export type ChecklistOption = 'required' | 'optional'
export type Priority = 0 | 1 | 2
export type SectionKey = keyof ResumeSchema
export type Mode = 'general_ats_check' | 'optimize_resume'

export type ScoreKey
  = | 'ats_parsing'
    | 'format_readability'
    | 'content_completeness'
    | 'impact_quantification'
    | 'job_match'

export type SuggestionKind
  = | 'replace_text'
    | 'replace_value'
    | 'fill_field'
    | 'normalize_date'

export type ValueType = 'string' | 'string_array' | 'object_array'

export type RawValue
  = | string
    | number
    | boolean
    | null
    | string[]
    | number[]
    | Record<string, unknown>
    | Array<Record<string, unknown>>

export type AfterValue
  = | string
    | null
    | string[]
    | number[]
    | Record<string, unknown>
    | Array<Record<string, unknown>>

export interface Locate {
  path: string
  sectionKey: SectionKey
  sectionLabel: string
  itemIndex: number | null
  itemId: string | null
  itemLabel: string | null
  fieldKey: string
  fieldLabel: string
}

export interface Meta {
  document_version: number
  language: 'zh'
  generated_at: string
  mode: Mode
  inputDigest: string
}

export interface ReadabilityIndex {
  score: number
  scale: { min: 1, max: 10 }
  summary: string
}

export interface FixChecklistItem {
  id: string
  title: string
  option: ChecklistOption
  isDone: boolean
}

export interface Action {
  title: string
  priority: Priority
  locate: Locate
}

export interface Summary {
  overall_score: number
  grade: string
  top_risks: string[]
  next_actions: Action[]
}

export interface ScoreItem {
  score: number
  max: number
}

export type Scores = Record<ScoreKey, ScoreItem> & {
  ats_parsing: ScoreItem
  format_readability: ScoreItem
  content_completeness: ScoreItem
  impact_quantification: ScoreItem
  job_match: ScoreItem
}

export interface Evidence {
  text: string
  rawValue: RawValue
  locate: Locate
}

export interface WhyBlock {
  summary: string
  evidence: Evidence[]
}

export interface Suggestion {
  kind: SuggestionKind
  valueType: ValueType
  locate: Locate
  before: AfterValue | null
  after: AfterValue | null
  reason: string
}

export interface FixBlock {
  summary: string
  steps: string[]
  suggestions: Suggestion[]
}

export interface Finding {
  id: string
  type: string
  title: string
  locate: Locate
  why: WhyBlock
  fix: FixBlock
}

export interface FindingsGroup {
  high: Finding[]
  medium: Finding[]
  low: Finding[]
}

export interface AtsEvaluationResult {
  id: string
  created_at: string
  history: AtsEvaluationResult[]
  user_id: string
  version: '1.0' | string
  resume_id: string
  meta: Meta
  readabilityIndex: ReadabilityIndex
  fixChecklist: FixChecklistItem[]
  summary: Summary
  scores: Scores
  findings: FindingsGroup
}
