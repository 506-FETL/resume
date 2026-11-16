import type {
  ScoreKey,
  Severity,
  SuggestionKind,
  ValueType,
} from '../../schema/ats.ts'
import { ATS_SCORE_MAX } from '../constants.ts'

export const SCORE_KEYS = Object.keys(ATS_SCORE_MAX) as ScoreKey[]

export const SEVERITIES: Severity[] = ['high', 'medium', 'low']

export const SUGGESTION_KINDS = new Set<SuggestionKind>([
  'replace_text',
  'replace_value',
  'fill_field',
  'normalize_date',
])

export const VALUE_TYPES = new Set<ValueType>([
  'string',
  'number',
  'boolean',
  'html_string',
  'string_array',
  'object_array',
])

export const PERSISTED_VALUE_TYPES = new Set<ValueType>([
  ...VALUE_TYPES,
  'object',
  'date_range',
  'skill_list',
  'skill_item',
  'certificate_list',
])

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function readStringList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
        .map((item) => item.trim()),
    ),
  ].slice(0, maxLength)
}

export function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true

  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    )
      return false

    return left.every((item, index) => deepEqual(item, right[index]))
  }

  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false

    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()

    if (!deepEqual(leftKeys, rightKeys)) return false

    return leftKeys.every((key) => deepEqual(left[key], right[key]))
  }

  return false
}
