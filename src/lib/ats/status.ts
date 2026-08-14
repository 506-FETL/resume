import type { Finding, FindingsGroup, Severity } from '../schema/ats.ts'

const SEVERITIES: Severity[] = ['high', 'medium', 'low']

export function isAtsFindingPending(finding: Finding): boolean {
  const suggestions = finding?.fix?.suggestions

  return !Array.isArray(suggestions)
    || suggestions.length === 0
    || suggestions.some(suggestion => suggestion?.fixed !== true)
}

export function countPendingAtsFindings(findings: FindingsGroup | null | undefined): number {
  return SEVERITIES.reduce((total, severity) => {
    const group = findings?.[severity]

    return total + (Array.isArray(group) ? group.filter(isAtsFindingPending).length : 0)
  }, 0)
}
