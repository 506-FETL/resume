import type { Suggestion, ValueType } from '../../schema/ats.ts'
import { isRecord } from './values.ts'

export const USER_INPUT_PLACEHOLDER_PATTERN = /待补充\s*[：:]/

export function valueContainsUserInputPlaceholder(value: unknown): boolean {
  if (typeof value === 'string')
    return USER_INPUT_PLACEHOLDER_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(valueContainsUserInputPlaceholder)
  if (isRecord(value))
    return Object.values(value).some(valueContainsUserInputPlaceholder)

  return false
}

export function toInternalSuggestionValueType(
  valueType: ValueType,
  path: string,
): ValueType {
  if (valueType !== 'object_array') return valueType

  const normalizedPath = path.toLowerCase()

  if (/(?:^|\.)skills$/.test(normalizedPath)) return 'skill_list'
  if (/(?:^|\.)certificates$/.test(normalizedPath)) return 'certificate_list'

  return valueType
}

export function suggestionNeedsUserInput(suggestion: Suggestion): boolean {
  return (
    suggestion.requiresUserInput === true ||
    valueContainsUserInputPlaceholder(suggestion.after)
  )
}

export function hasUnresolvedSuggestionInput(
  suggestions: Suggestion[],
): boolean {
  return suggestions.some((suggestion) => !isSuggestionReadyToApply(suggestion))
}

export function isNonEmptyPlainText(value: unknown): value is string {
  if (typeof value !== 'string') return false

  return (
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .trim().length > 0
  )
}

export function hasValidEntryId(value: Record<string, unknown>): boolean {
  return typeof value.entryId === 'string' && value.entryId.trim().length > 0
}

export function isSuggestionTypeCompatibleWithBefore(
  suggestion: Suggestion,
): boolean {
  const { before, locate, valueType } = suggestion

  if (before === null || before === undefined) return true
  if (typeof before === 'string')
    return valueType === 'string' || valueType === 'html_string'
  if (typeof before === 'number') return valueType === 'number'
  if (typeof before === 'boolean') return valueType === 'boolean'
  if (Array.isArray(before) && before.length === 0) {
    const path = locate.path.toLowerCase()

    if (/(?:^|\.)skills$/.test(path)) return valueType === 'skill_list'
    if (/(?:^|\.)certificates$/.test(path))
      return valueType === 'certificate_list'
    if (/(?:^|\.)hobbies$/.test(path)) return valueType === 'object_array'

    return valueType === 'string_array' || valueType === 'date_range'
  }
  if (Array.isArray(before) && before.every((item) => typeof item === 'string'))
    return valueType === 'string_array' || valueType === 'date_range'
  if (Array.isArray(before) && before.every((item) => isRecord(item)))
    return (
      valueType === 'object_array' ||
      valueType === 'skill_list' ||
      valueType === 'certificate_list'
    )
  if (isRecord(before))
    return valueType === 'object' || valueType === 'skill_item'

  return false
}

export function isSuggestionReadyToApply(suggestion: Suggestion): boolean {
  if (
    suggestionNeedsUserInput(suggestion) ||
    !isSuggestionTypeCompatibleWithBefore(suggestion)
  )
    return false

  const { after, kind, locate, valueType } = suggestion

  if (kind === 'replace_text' && valueType !== 'html_string') return false
  if (
    kind === 'normalize_date' &&
    valueType !== 'string_array' &&
    valueType !== 'date_range'
  )
    return false

  if (valueType === 'string' || valueType === 'html_string')
    return isNonEmptyPlainText(after)
  if (valueType === 'number')
    return typeof after === 'number' && Number.isFinite(after)
  if (valueType === 'boolean') return typeof after === 'boolean'
  if (valueType === 'string_array' || valueType === 'date_range') {
    return (
      Array.isArray(after) &&
      after.length > 0 &&
      (kind !== 'normalize_date' || after.length === 2) &&
      after.every((item) => typeof item === 'string' && item.trim().length > 0)
    )
  }
  if (valueType === 'skill_list') {
    const levels = new Set(['一般', '良好', '熟练', '擅长', '精通'])
    const displayTypes = new Set(['text', 'percentage'])

    return (
      Array.isArray(after) &&
      after.length > 0 &&
      after.every(
        (item) =>
          isRecord(item) &&
          hasValidEntryId(item) &&
          isNonEmptyPlainText(item.label) &&
          levels.has(String(item.proficiencyLevel)) &&
          displayTypes.has(String(item.displayType)),
      )
    )
  }
  if (valueType === 'certificate_list') {
    return (
      Array.isArray(after) &&
      after.length > 0 &&
      after.every(
        (item) =>
          isRecord(item) &&
          hasValidEntryId(item) &&
          isNonEmptyPlainText(item.name),
      )
    )
  }
  if (valueType === 'object_array') {
    if (
      !Array.isArray(after) ||
      after.length === 0 ||
      !after.every((item) => isRecord(item))
    )
      return false
    if (/(?:^|\.)hobbies$/.test(locate.path.toLowerCase())) {
      return after.every(
        (item) => hasValidEntryId(item) && isNonEmptyPlainText(item.name),
      )
    }

    return true
  }
  if (valueType === 'object' || valueType === 'skill_item')
    return isRecord(after) && Object.keys(after).length > 0

  return false
}
