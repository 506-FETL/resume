import { stableSerialize } from '@/lib/supabase/resume/history/snapshot'
import type { ResumeSnapshot } from '@/lib/supabase/resume/history'
import {
  DEFAULT_APPLICATION_INFO,
  DEFAULT_BASICS,
  DEFAULT_CAMPUS_EXPERIENCE,
  DEFAULT_EDU_BACKGROUND,
  DEFAULT_HOBBIES,
  DEFAULT_HONORS_CERTIFICATES,
  DEFAULT_INTERNSHIP_EXPERIENCE,
  DEFAULT_JOB_INTENT,
  DEFAULT_ORDER,
  DEFAULT_PROJECT_EXPERIENCE,
  DEFAULT_SELF_EVALUATION,
  DEFAULT_SKILL_SPECIALTY,
  DEFAULT_VISIBILITY,
  DEFAULT_WORK_EXPERIENCE,
  migrateOrder,
  migrateVisibility,
  normalizeResumeAppearance,
  normalizeResumeType,
  resolveResumeTemplateBinding,
} from '@/lib/schema'

export interface SnapshotFieldConfig {
  default: unknown
  legacyKey?: string
}

export type SnapshotSectionKey = Exclude<
  keyof ResumeSnapshot,
  | 'order'
  | 'visibility'
  | 'type'
  | 'spacing'
  | 'font'
  | 'theme'
  | 'templateBinding'
>

export const SNAPSHOT_FIELD_DEFAULTS: Record<
  SnapshotSectionKey,
  SnapshotFieldConfig
> = {
  basics: { default: DEFAULT_BASICS },
  job_intent: { default: DEFAULT_JOB_INTENT, legacyKey: 'jobIntent' },
  application_info: {
    default: DEFAULT_APPLICATION_INFO,
    legacyKey: 'applicationInfo',
  },
  edu_background: {
    default: DEFAULT_EDU_BACKGROUND,
    legacyKey: 'eduBackground',
  },
  work_experience: {
    default: DEFAULT_WORK_EXPERIENCE,
    legacyKey: 'workExperience',
  },
  internship_experience: {
    default: DEFAULT_INTERNSHIP_EXPERIENCE,
    legacyKey: 'internshipExperience',
  },
  campus_experience: {
    default: DEFAULT_CAMPUS_EXPERIENCE,
    legacyKey: 'campusExperience',
  },
  project_experience: {
    default: DEFAULT_PROJECT_EXPERIENCE,
    legacyKey: 'projectExperience',
  },
  skill_specialty: {
    default: DEFAULT_SKILL_SPECIALTY,
    legacyKey: 'skillSpecialty',
  },
  honors_certificates: {
    default: DEFAULT_HONORS_CERTIFICATES,
    legacyKey: 'honorsCertificates',
  },
  self_evaluation: {
    default: DEFAULT_SELF_EVALUATION,
    legacyKey: 'selfEvaluation',
  },
  hobbies: { default: DEFAULT_HOBBIES },
}

export function sanitizeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitizeDeep(item)]),
    ) as T
  }

  return value
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeTags(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，]/g)
      : []

  return Array.from(
    new Set(source.map((item) => String(item).trim()).filter(Boolean)),
  )
}

export function getSnapshotSectionValue<K extends SnapshotSectionKey>(
  key: K,
  sourceRecord?: Record<string, unknown>,
): ResumeSnapshot[K] {
  const { default: defaultValue, legacyKey } = SNAPSHOT_FIELD_DEFAULTS[key]

  const nextValue =
    sourceRecord?.[key] ??
    (legacyKey ? sourceRecord?.[legacyKey] : undefined) ??
    defaultValue

  return sanitizeDeep(nextValue) as ResumeSnapshot[K]
}

export function buildResumeSnapshot(source: unknown): ResumeSnapshot {
  const sourceRecord = isRecord(source) ? source : undefined

  const orderValue = Array.isArray(sourceRecord?.order)
    ? sourceRecord.order
    : DEFAULT_ORDER

  const visibilityValue = isRecord(sourceRecord?.visibility)
    ? (sourceRecord.visibility as Record<string, boolean>)
    : DEFAULT_VISIBILITY

  const type = normalizeResumeType(sourceRecord?.type)

  const templateBinding = resolveResumeTemplateBinding(
    sourceRecord?.templateBinding ?? sourceRecord?.template_binding,
  )

  return {
    basics: getSnapshotSectionValue('basics', sourceRecord),
    job_intent: getSnapshotSectionValue('job_intent', sourceRecord),
    application_info: getSnapshotSectionValue('application_info', sourceRecord),
    edu_background: getSnapshotSectionValue('edu_background', sourceRecord),
    work_experience: getSnapshotSectionValue('work_experience', sourceRecord),
    internship_experience: getSnapshotSectionValue(
      'internship_experience',
      sourceRecord,
    ),
    campus_experience: getSnapshotSectionValue(
      'campus_experience',
      sourceRecord,
    ),
    project_experience: getSnapshotSectionValue(
      'project_experience',
      sourceRecord,
    ),
    skill_specialty: getSnapshotSectionValue('skill_specialty', sourceRecord),
    honors_certificates: getSnapshotSectionValue(
      'honors_certificates',
      sourceRecord,
    ),
    self_evaluation: getSnapshotSectionValue('self_evaluation', sourceRecord),
    hobbies: getSnapshotSectionValue('hobbies', sourceRecord),
    order: migrateOrder(orderValue as string[]),
    visibility: migrateVisibility(visibilityValue),
    type,
    templateBinding,
    ...normalizeResumeAppearance(sourceRecord),
  }
}

export function getOrderedSections(
  snapshot: ResumeSnapshot,
): SnapshotSectionKey[] {
  const merged = ['basics', ...snapshot.order] as SnapshotSectionKey[]

  return Array.from(new Set(merged))
}

export function areSnapshotsEqual(
  left: ResumeSnapshot,
  right?: ResumeSnapshot | null,
) {
  if (!right) {
    return false
  }

  return stableSerialize(left) === stableSerialize(right)
}
