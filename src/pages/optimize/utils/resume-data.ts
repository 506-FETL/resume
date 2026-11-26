import type { ResumeSchema } from '@/lib/schema'
import { isCloudResumeId, ResumeNotFoundError } from '@/lib/resume-id'
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
  normalizeResumeFormData,
} from '@/lib/schema'
import { FORM_DATA_KEYS } from '@/store/resume/const'
import { readOwnedResumeRow } from '@/lib/supabase/resume/read-owned-row'
import { getCurrentUser } from '@/lib/supabase/user/profile'

export function sanitizeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}

    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val === undefined) return

      result[key] = sanitizeDeep(val)
    })

    return result as T
  }

  return value
}

export function mapDocToResumeSchema(
  doc: Record<string, unknown> | null | undefined,
): ResumeSchema {
  const source = doc as Record<string, any> | undefined

  const getVal = <T>(key: string, defaultVal: T, legacyKey?: string) => {
    const val =
      source?.[key] ??
      (legacyKey ? source?.[legacyKey] : undefined) ??
      defaultVal

    return sanitizeDeep(val as T)
  }

  return normalizeResumeFormData({
    basics: getVal('basics', DEFAULT_BASICS),
    job_intent: getVal('job_intent', DEFAULT_JOB_INTENT, 'jobIntent'),
    application_info: getVal(
      'application_info',
      DEFAULT_APPLICATION_INFO,
      'applicationInfo',
    ),
    edu_background: getVal(
      'edu_background',
      DEFAULT_EDU_BACKGROUND,
      'eduBackground',
    ),
    work_experience: getVal(
      'work_experience',
      DEFAULT_WORK_EXPERIENCE,
      'workExperience',
    ),
    internship_experience: getVal(
      'internship_experience',
      DEFAULT_INTERNSHIP_EXPERIENCE,
      'internshipExperience',
    ),
    campus_experience: getVal(
      'campus_experience',
      DEFAULT_CAMPUS_EXPERIENCE,
      'campusExperience',
    ),
    project_experience: getVal(
      'project_experience',
      DEFAULT_PROJECT_EXPERIENCE,
      'projectExperience',
    ),
    skill_specialty: getVal(
      'skill_specialty',
      DEFAULT_SKILL_SPECIALTY,
      'skillSpecialty',
    ),
    honors_certificates: getVal(
      'honors_certificates',
      DEFAULT_HONORS_CERTIFICATES,
      'honorsCertificates',
    ),
    self_evaluation: getVal(
      'self_evaluation',
      DEFAULT_SELF_EVALUATION,
      'selfEvaluation',
    ),
    hobbies: getVal('hobbies', DEFAULT_HOBBIES),
  })
}

export async function fetchResumeDataForAnalysis(
  id: string,
  isOffline: boolean,
): Promise<ResumeSchema> {
  if (isOffline) {
    const { getDB } = await import('@/lib/offline-resume-manager/database')
    const db = await getDB()
    const offlineResume = await db.get('resumes', id)

    if (!offlineResume) {
      throw new Error('离线简历不存在')
    }

    return mapDocToResumeSchema(offlineResume.data)
  }

  if (!isCloudResumeId(id)) throw new ResumeNotFoundError()

  const user = await getCurrentUser()

  if (!user) throw new Error('用户未登录')

  const onlineResume = await readOwnedResumeRow(
    id,
    user.id,
    FORM_DATA_KEYS.join(','),
  )

  return mapDocToResumeSchema(onlineResume)
}
