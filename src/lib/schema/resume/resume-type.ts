export const RESUME_TYPES = ['default', 'simple', 'modern'] as const

export type ResumeType = (typeof RESUME_TYPES)[number]

export function normalizeResumeType(value: unknown): ResumeType {
  if (value === 'default' || value === 'simple' || value === 'modern') {
    return value
  }

  if (value === 'basic') {
    return 'default'
  }

  return 'default'
}
