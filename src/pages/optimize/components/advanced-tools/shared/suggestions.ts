import type { SuggestionKind, ValueType } from '@/pages/optimize/types'
import { detectValueType, getFieldLabel } from '@/pages/optimize/utils'
import {
  COLLECTION_LABEL_MAP,
  ITEM_LABEL_PREFIX_MAP,
  SECTION_LABEL_MAP,
} from './const'
import { isStructurallyEmpty } from './text'

type PathSegment = string | number

function pathToString(path: PathSegment[]) {
  return path.reduce((result, segment, index) => {
    if (typeof segment === 'number') {
      return `${result}[${segment}]`
    }

    return index === 0 ? segment : `${result}.${segment}`
  }, '')
}

function getFieldLabelFromPath(path: PathSegment[]) {
  const pathString = pathToString(path)
  const collectionLabel = COLLECTION_LABEL_MAP[pathString]

  if (collectionLabel) {
    return collectionLabel
  }

  const lastStringSegment = [...path]
    .reverse()
    .find((segment) => typeof segment === 'string')

  if (!lastStringSegment || lastStringSegment === path[0]) {
    const sectionKey = String(path[0] ?? '')

    return (
      SECTION_LABEL_MAP[
        sectionKey as keyof import('@/lib/schema').ResumeSchema
      ] ?? sectionKey
    )
  }

  return getFieldLabel(String(lastStringSegment))
}

function getItemLabelFromPath(path: PathSegment[]) {
  const itemIndex = path.findIndex((segment) => segment === 'items')

  if (itemIndex >= 0 && typeof path[itemIndex + 1] === 'number') {
    const sectionKey = String(path[0] ?? '')

    const prefix =
      ITEM_LABEL_PREFIX_MAP[`${sectionKey}.items`] ??
      SECTION_LABEL_MAP[sectionKey as keyof import('@/lib/schema').ResumeSchema]

    return `${prefix} ${Number(path[itemIndex + 1]) + 1}`
  }

  for (let i = path.length - 1; i >= 0; i--) {
    if (typeof path[i] !== 'number') {
      continue
    }

    const collectionPath = pathToString(path.slice(0, i))
    const prefix = ITEM_LABEL_PREFIX_MAP[collectionPath]

    if (prefix) {
      return `${prefix} ${Number(path[i]) + 1}`
    }
  }

  return null
}

export function toSuggestionLocate(path: PathSegment[]) {
  return {
    path: pathToString(path),
    sectionLabel:
      SECTION_LABEL_MAP[
        String(path[0]) as keyof import('@/lib/schema').ResumeSchema
      ] ?? String(path[0]),
    fieldLabel: getFieldLabelFromPath(path),
    itemLabel: getItemLabelFromPath(path),
  }
}

export function pickSuggestionKind(
  before: unknown,
  after: unknown,
  path: string,
): SuggestionKind {
  if (isStructurallyEmpty(before) && !isStructurallyEmpty(after)) {
    return 'fill_field'
  }

  if (
    path.endsWith('Duration') ||
    path.endsWith('.duration') ||
    path.endsWith('birthMonth') ||
    path.endsWith('dateEntry')
  ) {
    return 'normalize_date'
  }

  if (
    (typeof before === 'string' || typeof after === 'string') &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    return 'replace_text'
  }

  return 'replace_value'
}

export function toSuggestionValueType(value: unknown): ValueType {
  const detected = detectValueType(value)

  return detected === 'empty' ? 'string' : detected
}

export function getSectionScoreClassName(score: number) {
  if (score >= 80) {
    return 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
  }

  if (score >= 60) {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }

  return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
}

export function getMetricStatusClassName(status: 'good' | 'warn' | 'missing') {
  if (status === 'good') {
    return 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300'
  }

  if (status === 'warn') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }

  return 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'
}
