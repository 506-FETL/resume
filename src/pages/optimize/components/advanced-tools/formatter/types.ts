import type { Severity, Suggestion } from '@/pages/optimize/types'

export interface BatchOptimizationItem {
  autoApplicableSuggestionCount: number
  conflictedSuggestionCount: number
  findingId: string
  fixSummary: string
  locationText: string
  pendingSuggestionCount: number
  pendingSuggestions: Suggestion[]
  requiresInputSuggestionCount: number
  severity: Severity
  steps: string[]
  title: string
}

export interface BatchOptimizationResult {
  appliedSuggestionIds: string[]
  autoApplicableIssueCount: number
  autoApplicableSuggestionCount: number
  conflictedSuggestionCount: number
  fixedIssueCount: number
  items: BatchOptimizationItem[]
  pendingIssueCount: number
  pendingSuggestionCount: number
  requiresInputSuggestionCount: number
  suggestionsToApply: Suggestion[]
  summary: string[]
  totalIssueCount: number
}
