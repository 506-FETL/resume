import type { RawValue } from '../../schema/ats.ts'
import { ATS_FIELD_LABELS, ATS_SECTION_LABELS } from '../constants.ts'
import type { AtsAssessmentField, AtsAssessmentSection } from '../types.ts'

export type AtsSectionKey = keyof typeof ATS_SECTION_LABELS

export function normalizePlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isMeaningfulAtsValue(value: unknown): boolean {
  if (value === null || value === undefined) return false

  if (typeof value === 'string') {
    const normalized = normalizePlainText(value)

    return normalized !== '' && normalized !== '不填'
  }

  if (typeof value === 'number') return Number.isFinite(value) && value !== 0

  if (typeof value === 'boolean') return value

  if (Array.isArray(value))
    return value.some((item) => isMeaningfulAtsValue(item))

  if (typeof value === 'object')
    return Object.entries(value).some(
      ([key, item]) => key !== 'entryId' && isMeaningfulAtsValue(item),
    )

  return false
}

export function toRawValue(value: unknown): RawValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    Array.isArray(value) ||
    (typeof value === 'object' && value !== null)
  ) {
    return value as RawValue
  }

  return null
}

export function createField(config: {
  fieldKey: string
  itemLabel: string | null
  path: string
  rawValue: unknown
  requiredWithinEntry?: boolean
  sectionKey: AtsSectionKey
}): AtsAssessmentField {
  return {
    locate: {
      path: config.path,
      sectionLabel: ATS_SECTION_LABELS[config.sectionKey],
      fieldLabel: ATS_FIELD_LABELS[config.fieldKey] ?? config.fieldKey,
      itemLabel: config.itemLabel,
    },
    rawValue: toRawValue(config.rawValue),
    requiredWithinEntry: config.requiredWithinEntry ?? false,
  }
}

export function createSingleItemSection(
  key: AtsSectionKey,
  fields: AtsAssessmentField[],
): AtsAssessmentSection | null {
  if (fields.length === 0) return null

  return {
    key,
    label: ATS_SECTION_LABELS[key],
    items: [
      {
        entryId: null,
        itemLabel: null,
        sourceIndex: null,
        fields,
      },
    ],
  }
}
