import type { Finding, FindingsGroup, Severity } from '../schema/ats.ts'
import { ensureAtsFindingsHaveSuggestions } from './result.ts'

const SEVERITIES: Severity[] = ['high', 'medium', 'low']

export function isAtsFindingPending(finding: Finding): boolean {
  const suggestions = finding?.fix?.suggestions

  return !Array.isArray(suggestions)
    || suggestions.length === 0
    || suggestions.some(suggestion => suggestion?.fixed !== true)
}

export function countPendingAtsFindings(findings: FindingsGroup | null | undefined): number {
  const effectiveFindings = ensureAtsFindingsHaveSuggestions(findings)

  return SEVERITIES.reduce((total, severity) => {
    const group = effectiveFindings[severity]

    return total + group.filter(isAtsFindingPending).length
  }, 0)
}
