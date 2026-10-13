import type { ResumeSchema } from '../form'

/** LLM 视图字段到持久化字段的唯一映射；经历字段位于 section.items 中。 */
export const VARIANT_FIELD_MAPPINGS = {
  job_intent: { fieldPath: 'content', snapshotField: 'jobIntent', collection: false },
  skill_specialty: { fieldPath: 'content', snapshotField: 'description', collection: false },
  self_evaluation: { fieldPath: 'content', snapshotField: 'content', collection: false },
  work_experience: { fieldPath: 'description', snapshotField: 'workInfo', collection: true },
  internship_experience: { fieldPath: 'description', snapshotField: 'internshipInfo', collection: true },
  project_experience: { fieldPath: 'description', snapshotField: 'projectInfo', collection: true },
  campus_experience: { fieldPath: 'description', snapshotField: 'campusInfo', collection: true },
} as const satisfies Partial<Record<keyof ResumeSchema, {
  fieldPath: string
  snapshotField: string
  collection: boolean
}>>

export function getVariantFieldMapping(section: keyof ResumeSchema, fieldPath: string) {
  if (!Object.hasOwn(VARIANT_FIELD_MAPPINGS, section)) {
    return undefined
  }
  const mapping = VARIANT_FIELD_MAPPINGS[section as keyof typeof VARIANT_FIELD_MAPPINGS]
  return mapping.fieldPath === fieldPath ? mapping : undefined
}
