import {
  flattenAssessmentFields,
  isMeaningfulAtsValue,
} from '../assessment-input.ts'
import type { AtsAssessmentField, AtsAssessmentInput } from '../types.ts'
import { isRecord } from './values.ts'

export function buildFieldCatalog(
  input: AtsAssessmentInput,
): Map<string, AtsAssessmentField> {
  const contactPaths = new Set(['basics.phone', 'basics.email'])

  const fields = flattenAssessmentFields(input).filter((field) => {
    if (!input.scope.hasContactMethod || !contactPaths.has(field.locate.path))
      return true

    return isMeaningfulAtsValue(field.rawValue)
  })

  return new Map(fields.map((field) => [field.locate.path, field]))
}

export function resolveField(
  rawLocate: unknown,
  catalog: Map<string, AtsAssessmentField>,
): AtsAssessmentField | null {
  if (!isRecord(rawLocate) || typeof rawLocate.path !== 'string') return null

  return catalog.get(rawLocate.path) ?? null
}
