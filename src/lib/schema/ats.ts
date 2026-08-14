// =====================
// ATS Evaluation Types
// =====================
export type ChecklistOption = 'required' | 'optional'
export type Priority = 0 | 1 | 2
export type Mode = 'general_ats_check' | 'optimize_resume'
export type Severity = 'high' | 'medium' | 'low'

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

export type ValueType
  = | 'string'
    | 'number'
    | 'boolean'
    | 'html_string'
    | 'string_array'
    | 'object_array'
    | 'object'
    | 'date_range'
    | 'skill_list'
    | 'skill_item'
    | 'certificate_list'

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
    | number
    | boolean
    | null
    | string[]
    | number[]
    | Record<string, unknown>
    | Array<Record<string, unknown>>

export interface Locate {
  path: string
  sectionLabel: string
  fieldLabel: string
  itemLabel: string | null
}

export interface Meta {
  document_version: number
  language: 'zh' | string
  generated_at: string
  mode: Mode
  inputDigest: string
  rubricVersion?: '2.0' | string
  assessment?: AtsAssessmentMeta
}

export interface AtsAssessmentMeta {
  candidateProfile: string
  inferredTarget: string
  basisSummary: string
  evaluatedSections: string[]
  evidenceSignals: string[]
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
  rationale?: string
}

export type Scores = Record<ScoreKey, ScoreItem>

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
  fixed: boolean
  requiresUserInput?: boolean
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

export type AtsRecordId = number

export interface AtsEvaluationResult {
  id: AtsRecordId
  todo_items: string[]
  created_at: string
  user_id: string
  resume_id: string
  version: '1.0' | string

  meta: Meta
  readabilityIndex: ReadabilityIndex
  fixChecklist: FixChecklistItem[]
  summary: Summary
  scores: Scores
  findings: FindingsGroup
}

export type AtsWritableFieldKey
  = | 'todo_items'
    | 'version'
    | 'meta'
    | 'readabilityIndex'
    | 'fixChecklist'
    | 'summary'
    | 'scores'
    | 'findings'

export type AtsWritableFields = Pick<AtsEvaluationResult, AtsWritableFieldKey>

export type AtsPersistPatch = Partial<AtsWritableFields> & {
  resume_id?: AtsEvaluationResult['resume_id']
}

export type AtsCreatePayload = Partial<AtsWritableFields> & {
  resume_id: AtsEvaluationResult['resume_id']
}

export type AtsLlmDraft = Partial<AtsWritableFields> & {
  id?: unknown
  created_at?: unknown
  user_id?: unknown
  resume_id?: string
}
