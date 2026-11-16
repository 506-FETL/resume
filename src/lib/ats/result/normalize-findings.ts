import type {
  Evidence,
  Finding,
  FindingsGroup,
  Severity,
  Suggestion,
} from '../../schema/ats.ts'
import type { AtsAssessmentField } from '../types.ts'
import { buildFallbackSuggestion } from './fallback-suggestion.ts'
import { resolveField } from './field-catalog.ts'
import { normalizeSuggestion } from './normalize-suggestions.ts'
import { ensureAtsFindingsHaveSuggestions } from './persisted-findings.ts'
import {
  deepEqual,
  isRecord,
  readString,
  readStringList,
  SEVERITIES,
} from './values.ts'

export function normalizeEvidence(
  rawEvidence: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Evidence | null {
  if (!isRecord(rawEvidence)) return null

  const field = resolveField(rawEvidence.locate, catalog)
  const text = readString(rawEvidence.text)

  if (!field || !text || !deepEqual(rawEvidence.rawValue, field.rawValue))
    return null

  return {
    text,
    rawValue: field.rawValue,
    locate: field.locate,
  }
}

export function normalizeFinding(
  rawFinding: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Omit<Finding, 'id'> | null {
  if (!isRecord(rawFinding)) return null

  const field = resolveField(rawFinding.locate, catalog)
  const title = readString(rawFinding.title)
  const rawWhy = isRecord(rawFinding.why) ? rawFinding.why : null
  const rawFix = isRecord(rawFinding.fix) ? rawFinding.fix : null

  if (!field || !title || !rawWhy || !rawFix) return null

  const evidence = Array.isArray(rawWhy.evidence)
    ? rawWhy.evidence
        .map((item) => normalizeEvidence(item, catalog))
        .filter((item): item is Evidence => item !== null)
    : []

  if (
    evidence.length === 0 ||
    !evidence.some((item) => item.locate.path === field.locate.path)
  )
    return null

  const suggestions = Array.isArray(rawFix.suggestions)
    ? rawFix.suggestions
        .map((item) => normalizeSuggestion(item, catalog))
        .filter((item): item is Suggestion => item !== null)
    : []

  const fixSummary = readString(rawFix.summary, title)
  const steps = readStringList(rawFix.steps, 4)

  return {
    type: readString(rawFinding.type, 'content_issue')
      .replace(/\W+/g, '_')
      .toLowerCase(),
    title,
    locate: field.locate,
    why: {
      summary: readString(rawWhy.summary, title),
      evidence,
    },
    fix: {
      summary: fixSummary,
      steps,
      suggestions:
        suggestions.length > 0
          ? suggestions
          : [buildFallbackSuggestion(field, fixSummary, steps)],
    },
  }
}

export function normalizeFindings(
  rawFindings: unknown,
  catalog: Map<string, AtsAssessmentField>,
): FindingsGroup {
  const source = isRecord(rawFindings) ? rawFindings : {}

  const prefixes: Record<Severity, string> = {
    high: 'H',
    medium: 'M',
    low: 'L',
  }

  const findings = Object.fromEntries(
    SEVERITIES.map((severity) => {
      const rawGroup = Array.isArray(source[severity]) ? source[severity] : []

      const normalized = rawGroup
        .map((item) => normalizeFinding(item, catalog))
        .filter((item): item is Omit<Finding, 'id'> => item !== null)
        .map(
          (item, index): Finding => ({
            ...item,
            id: `${prefixes[severity]}-${String(index + 1).padStart(3, '0')}`,
          }),
        )

      return [severity, normalized]
    }),
  ) as unknown as FindingsGroup

  return ensureAtsFindingsHaveSuggestions(findings)
}
