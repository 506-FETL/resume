export const JOB_PROFILE_LIMITS = {
  company: 200,
  position: 200,
  location: 200,
  salary: 200,
  source: 2000,
} as const

export type JobProfile = Record<keyof typeof JOB_PROFILE_LIMITS, string | null>

export function validateJobProfile(value: unknown, text: string): JobProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('识别结果无效')

  const record = value as Record<string, unknown>
  const profile = {} as JobProfile

  if (Object.keys(record).some((key) => !(key in JOB_PROFILE_LIMITS)))
    throw new Error('识别结果包含未知字段')

  for (const [key, limit] of Object.entries(JOB_PROFILE_LIMITS)) {
    const field = record[key]

    if (field == null || field === '') {
      profile[key as keyof JobProfile] = null

      continue
    }
    if (
      typeof field !== 'string' ||
      field.length > limit ||
      field.trim() !== field ||
      !text.includes(field)
    )
      throw new Error('识别结果缺少原文依据')

    profile[key as keyof JobProfile] = field
  }

  return profile
}
