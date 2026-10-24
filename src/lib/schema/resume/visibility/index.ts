import type { ZodBoolean } from 'zod'
import type { ORDERType } from '../form'
import { z } from 'zod'

type VisibilityKey = Exclude<ORDERType, 'basics'>

type VisibilityForms = Record<VisibilityKey, ZodBoolean>

export const visibilityFormsSchema = z.object<VisibilityForms>({
  job_intent: z.boolean(),
  application_info: z.boolean(),
  edu_background: z.boolean(),
  work_experience: z.boolean(),
  internship_experience: z.boolean(),
  campus_experience: z.boolean(),
  project_experience: z.boolean(),
  skill_specialty: z.boolean(),
  honors_certificates: z.boolean(),
  self_evaluation: z.boolean(),
  hobbies: z.boolean(),
})

export type VisibilityFormType = z.infer<typeof visibilityFormsSchema>

export const DEFAULT_VISIBILITY: VisibilityFormType = {
  job_intent: false,
  application_info: true,
  edu_background: false,
  work_experience: false,
  internship_experience: false,
  campus_experience: false,
  project_experience: false,
  skill_specialty: false,
  honors_certificates: false,
  self_evaluation: false,
  hobbies: false,
}
