import type {
  AfterValue,
  Suggestion,
  SuggestionKind,
  ValueType,
} from '../../schema/ats.ts'
import type { AtsAssessmentField } from '../types.ts'
import { resolveField } from './field-catalog.ts'
import { toInternalSuggestionValueType } from './suggestion-readiness.ts'
import {
  deepEqual,
  isRecord,
  readString,
  SUGGESTION_KINDS,
  VALUE_TYPES,
} from './values.ts'

export function isNonEmptyAfter(
  value: unknown,
  valueType: ValueType,
): value is AfterValue {
  if (valueType === 'number')
    return typeof value === 'number' && Number.isFinite(value)

  if (valueType === 'boolean') return typeof value === 'boolean'

  if (valueType === 'string' || valueType === 'html_string') {
    if (typeof value !== 'string') return false

    const plainText = value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .trim()

    return plainText.length > 0
  }

  if (valueType === 'string_array') {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === 'string' && item.trim().length > 0)
    )
  }

  if (valueType === 'object_array') {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => isRecord(item))
    )
  }

  return false
}

export function isValueTypeCompatibleWithField(
  valueType: ValueType,
  field: AtsAssessmentField,
): boolean {
  const { rawValue } = field

  if (typeof rawValue === 'string')
    return valueType === 'string' || valueType === 'html_string'
  if (typeof rawValue === 'number') return valueType === 'number'
  if (typeof rawValue === 'boolean') return valueType === 'boolean'
  if (Array.isArray(rawValue) && rawValue.length === 0) {
    return /(?:^|\.)(?:skills|certificates|hobbies)$/.test(
      field.locate.path.toLowerCase(),
    )
      ? valueType === 'object_array'
      : valueType === 'string_array'
  }
  if (
    Array.isArray(rawValue) &&
    rawValue.every((item) => typeof item === 'string')
  )
    return valueType === 'string_array'
  if (Array.isArray(rawValue) && rawValue.every((item) => isRecord(item)))
    return valueType === 'object_array'

  return false
}

export function normalizeSuggestion(
  rawSuggestion: unknown,
  catalog: Map<string, AtsAssessmentField>,
): Suggestion | null {
  if (!isRecord(rawSuggestion)) return null

  const field = resolveField(rawSuggestion.locate, catalog)

  if (!field || !deepEqual(rawSuggestion.before, field.rawValue)) return null

  const kind = rawSuggestion.kind
  const valueType = rawSuggestion.valueType

  if (
    !SUGGESTION_KINDS.has(kind as SuggestionKind) ||
    !VALUE_TYPES.has(valueType as ValueType)
  )
    return null

  const normalizedKind = kind as SuggestionKind
  const normalizedValueType = valueType as ValueType

  if (!isValueTypeCompatibleWithField(normalizedValueType, field)) return null
  if (!isNonEmptyAfter(rawSuggestion.after, normalizedValueType)) return null

  if (
    normalizedKind === 'replace_text' &&
    normalizedValueType !== 'html_string'
  )
    return null
  if (normalizedKind === 'normalize_date') {
    if (
      normalizedValueType !== 'string_array' ||
      !Array.isArray(rawSuggestion.after) ||
      rawSuggestion.after.length !== 2
    )
      return null
  }

  return {
    kind: normalizedKind,
    valueType: toInternalSuggestionValueType(
      normalizedValueType,
      field.locate.path,
    ),
    locate: field.locate,
    before: field.rawValue as AfterValue,
    after: rawSuggestion.after,
    reason: readString(rawSuggestion.reason, '请结合真实情况确认后再应用。'),
    fixed: false,
  }
}
