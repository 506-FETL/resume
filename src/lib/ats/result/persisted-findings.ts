import type {
  Evidence,
  Finding,
  FindingsGroup,
  Suggestion,
  SuggestionKind,
  ValueType,
} from '../../schema/ats.ts'
import { buildFallbackSuggestion } from './fallback-suggestion.ts'
import { toInternalSuggestionValueType } from './suggestion-readiness.ts'
import {
  isRecord,
  PERSISTED_VALUE_TYPES,
  readString,
  SUGGESTION_KINDS,
} from './values.ts'

export function ensureAtsFindingsHaveSuggestions(
  findings: unknown,
): FindingsGroup {
  const source = isRecord(findings) ? findings : {}

  const normalizeLocate = (value: unknown): Finding['locate'] | null => {
    if (
      !isRecord(value) ||
      typeof value.path !== 'string' ||
      value.path.trim().length === 0
    )
      return null

    return {
      path: value.path.trim(),
      sectionLabel:
        typeof value.sectionLabel === 'string' ? value.sectionLabel : '',
      fieldLabel: typeof value.fieldLabel === 'string' ? value.fieldLabel : '',
      itemLabel: typeof value.itemLabel === 'string' ? value.itemLabel : null,
    }
  }

  const normalizeEvidenceEntry = (value: unknown): Evidence | null => {
    if (
      !isRecord(value) ||
      !Object.hasOwn(value, 'rawValue') ||
      value.rawValue === undefined
    )
      return null

    const locate = normalizeLocate(value.locate)

    if (!locate) return null

    return {
      text: typeof value.text === 'string' ? value.text : '',
      rawValue: value.rawValue as Evidence['rawValue'],
      locate,
    }
  }

  const normalizeSuggestionEntry = (value: unknown): Suggestion | null => {
    if (
      !isRecord(value) ||
      !Object.hasOwn(value, 'after') ||
      value.after === undefined
    )
      return null

    const locate = normalizeLocate(value.locate)
    const kind = value.kind
    const valueType = value.valueType

    if (
      !locate ||
      !SUGGESTION_KINDS.has(kind as SuggestionKind) ||
      !PERSISTED_VALUE_TYPES.has(valueType as ValueType)
    ) {
      return null
    }

    return {
      kind: kind as SuggestionKind,
      valueType: toInternalSuggestionValueType(
        valueType as ValueType,
        locate.path,
      ),
      locate,
      before: (value.before ?? null) as Suggestion['before'],
      after: value.after as Suggestion['after'],
      reason: typeof value.reason === 'string' ? value.reason : '',
      fixed: value.fixed === true,
      ...(value.requiresUserInput === true ? { requiresUserInput: true } : {}),
    }
  }

  const ensureFinding = (value: unknown): Finding | null => {
    if (
      !isRecord(value) ||
      !isRecord(value.fix) ||
      !isRecord(value.why) ||
      !Array.isArray(value.why.evidence)
    )
      return null

    const locate = normalizeLocate(value.locate)
    const id = readString(value.id)
    const title = readString(value.title)

    if (!locate || !id || !title) return null

    const evidence = value.why.evidence
      .map(normalizeEvidenceEntry)
      .filter((entry): entry is Evidence => entry !== null)

    const suggestions = (
      Array.isArray(value.fix.suggestions) ? value.fix.suggestions : []
    )
      .map(normalizeSuggestionEntry)
      .filter((entry): entry is Suggestion => entry !== null)

    const fixSummary = readString(value.fix.summary, title)

    const steps = Array.isArray(value.fix.steps)
      ? value.fix.steps.filter(
          (step): step is string => typeof step === 'string',
        )
      : []

    const finding: Finding = {
      id,
      type: readString(value.type, 'content_issue'),
      title,
      locate,
      why: {
        summary: readString(value.why.summary, title),
        evidence,
      },
      fix: {
        summary: fixSummary,
        steps,
        suggestions,
      },
    }

    if (suggestions.length > 0) {
      return {
        ...finding,
        fix: {
          ...finding.fix,
          suggestions,
        },
      }
    }

    const matchingEvidence = evidence.find(
      (item) => item.locate.path === locate.path,
    )

    if (!matchingEvidence) return null

    return {
      ...finding,
      fix: {
        ...finding.fix,
        suggestions: [
          buildFallbackSuggestion(
            {
              locate,
              rawValue: matchingEvidence.rawValue,
              requiredWithinEntry: true,
            },
            fixSummary,
            steps,
          ),
        ],
      },
    }
  }

  const ensureGroup = (group: unknown) =>
    (Array.isArray(group) ? group : [])
      .map(ensureFinding)
      .filter((finding): finding is Finding => finding !== null)

  return {
    high: ensureGroup(source.high),
    medium: ensureGroup(source.medium),
    low: ensureGroup(source.low),
  }
}
