import type { VisibilityFormType } from '../visibility'
import { z } from 'zod'
import { DEFAULT_VISIBILITY } from '../visibility'
import { applicationInfoForm } from './applicationInfo'
import { basicsSchema } from './basic'
import { campusExperienceFormSchema } from './campusExperience'
import { eduBackgroundFormSchema } from './eduBackground'
import { hobbiesFormSchema } from './hobbies'
import { honorsCertificatesFormSchema } from './honorsCertificates'
import { internshipExperienceFormSchema } from './internshipExperience'
import { jobIntentFormSchema } from './jobIntent'
import { projectExperienceFormSchema } from './projectExperience'
import { selfEvaluationFormSchema } from './selfEvaluation'
import { skillSpecialtyFormSchema } from './skillSpecialty'
import { workExperienceFormSchema } from './workExperience'

export const resumeSchema = z.object({
  basics: basicsSchema,
  job_intent: jobIntentFormSchema,
  application_info: applicationInfoForm,
  edu_background: eduBackgroundFormSchema,
  work_experience: workExperienceFormSchema,
  internship_experience: internshipExperienceFormSchema,
  campus_experience: campusExperienceFormSchema,
  project_experience: projectExperienceFormSchema,
  skill_specialty: skillSpecialtyFormSchema,
  honors_certificates: honorsCertificatesFormSchema,
  self_evaluation: selfEvaluationFormSchema,
  hobbies: hobbiesFormSchema,
})

export type ResumeSchema = z.infer<typeof resumeSchema>

export * from './applicationInfo'

export * from './basic'

export * from './campusExperience'

export * from './eduBackground'

export * from './hobbies'

export * from './honorsCertificates'

export * from './internshipExperience'

export * from './jobIntent'

export * from './projectExperience'

export * from './selfEvaluation'

export * from './skillSpecialty'

export * from './workExperience'

export type ORDERType = keyof ResumeSchema

export type VisibilityItemsType = Exclude<ORDERType, 'basics'>

export const DEFAULT_ORDER: ORDERType[] = [
  'basics',
  'job_intent',
  'application_info',
  'edu_background',
  'work_experience',
  'internship_experience',
  'campus_experience',
  'project_experience',
  'skill_specialty',
  'honors_certificates',
  'self_evaluation',
  'hobbies',
]

/** camelCase → snake_case 映射，用于迁移旧 order/visibility 中的值 */
export const LEGACY_KEY_MAP: Record<string, string> = {
  jobIntent: 'job_intent',
  applicationInfo: 'application_info',
  eduBackground: 'edu_background',
  workExperience: 'work_experience',
  internshipExperience: 'internship_experience',
  campusExperience: 'campus_experience',
  projectExperience: 'project_experience',
  skillSpecialty: 'skill_specialty',
  honorsCertificates: 'honors_certificates',
  selfEvaluation: 'self_evaluation',
}

/** 将 order 数组中的旧 camelCase 值迁移为 snake_case */
export function migrateOrder(order: string[]): ORDERType[] {
  return order.map((key) => (LEGACY_KEY_MAP[key] ?? key) as ORDERType)
}

/** 将 visibility 对象中的旧 camelCase 键迁移为 snake_case */
export function migrateVisibility(
  visibility?: Partial<Record<string, boolean>> | null,
): VisibilityFormType {
  const result: VisibilityFormType = { ...DEFAULT_VISIBILITY }

  if (!visibility) {
    return result
  }

  for (const [key, value] of Object.entries(visibility)) {
    const normalizedKey = LEGACY_KEY_MAP[key] ?? key

    if (normalizedKey in result && typeof value === 'boolean') {
      result[normalizedKey as keyof VisibilityFormType] = value
    }
  }

  return result
}
