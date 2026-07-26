import type { ResumeSchema } from './form'
import {
  DEFAULT_APPLICATION_INFO,
  DEFAULT_BASICS,
  DEFAULT_CAMPUS_EXPERIENCE,
  DEFAULT_EDU_BACKGROUND,
  DEFAULT_HOBBIES,
  DEFAULT_HONORS_CERTIFICATES,
  DEFAULT_INTERNSHIP_EXPERIENCE,
  DEFAULT_JOB_INTENT,
  DEFAULT_PROJECT_EXPERIENCE,
  DEFAULT_SELF_EVALUATION,
  DEFAULT_SKILL_SPECIALTY,
  DEFAULT_WORK_EXPERIENCE,
} from './form'

const RESUME_FORM_DEFAULTS: { [K in keyof ResumeSchema]: ResumeSchema[K] } = {
  basics: DEFAULT_BASICS,
  job_intent: DEFAULT_JOB_INTENT,
  application_info: DEFAULT_APPLICATION_INFO,
  edu_background: DEFAULT_EDU_BACKGROUND,
  work_experience: DEFAULT_WORK_EXPERIENCE,
  internship_experience: DEFAULT_INTERNSHIP_EXPERIENCE,
  campus_experience: DEFAULT_CAMPUS_EXPERIENCE,
  project_experience: DEFAULT_PROJECT_EXPERIENCE,
  skill_specialty: DEFAULT_SKILL_SPECIALTY,
  honors_certificates: DEFAULT_HONORS_CERTIFICATES,
  self_evaluation: DEFAULT_SELF_EVALUATION,
  hobbies: DEFAULT_HOBBIES,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    )
  }

  return value
}

function mergeWithDefaults(value: unknown, defaultValue: unknown): unknown {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value)
      ? value.map(item => cloneValue(item))
      : defaultValue.map(item => cloneValue(item))
  }

  if (isRecord(defaultValue)) {
    const source = isRecord(value) ? value : {}
    const result = cloneValue(source) as Record<string, unknown>

    for (const [key, itemDefault] of Object.entries(defaultValue)) {
      result[key] = mergeWithDefaults(source[key], itemDefault)
    }

    return result
  }

  return value == null ? defaultValue : value
}

export function normalizeResumeSection<K extends keyof ResumeSchema>(
  key: K,
  value: unknown,
): ResumeSchema[K] {
  return mergeWithDefaults(value, RESUME_FORM_DEFAULTS[key]) as ResumeSchema[K]
}

export function normalizeResumeFormData(value: unknown): ResumeSchema {
  const source = isRecord(value) ? value : {}
  const keys = Object.keys(RESUME_FORM_DEFAULTS) as (keyof ResumeSchema)[]

  return Object.fromEntries(
    keys.map(key => [key, normalizeResumeSection(key, source[key])]),
  ) as ResumeSchema
}
