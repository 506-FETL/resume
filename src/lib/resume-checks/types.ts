import type { ORDERType, PersistedResumeSnapshot } from '@/lib/schema'

export type CheckSeverity = 'error' | 'warning' | 'suggestion'

export interface CheckTarget {
  section: ORDERType
  path: string
  quote: string
  entryId?: string
  occurrence?: number
}

export interface ResumeCheckIssue {
  id: string
  section: ORDERType
  kind:
    | 'missing'
    | 'contact'
    | 'date'
    | 'term'
    | 'spelling'
    | 'example'
    | 'layout'
  severity: CheckSeverity
  source: 'rule' | 'ai' | 'layout'
  title: string
  detail: string
  targets: CheckTarget[]
  signature: string
  resolved: boolean
  replacement?: string
}

export interface ResumeCheckResult {
  issues: ResumeCheckIssue[]
  aiEvidence: CheckTarget[]
}

export type CheckSnapshot = PersistedResumeSnapshot

export interface CheckPatch {
  section: ORDERType
  before: CheckSnapshot[ORDERType]
  after: CheckSnapshot[ORDERType]
}
