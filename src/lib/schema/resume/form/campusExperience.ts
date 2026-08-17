import { z } from 'zod'
import { createExperienceSchema, durationField } from './shared'

const experienceName = z.string().trim().default('')
export type CampusExperienceName = z.infer<typeof experienceName>

const role = z.string().trim().default('')
export type CampusRole = z.infer<typeof role>

const duration = durationField.default(['', ''])
export type CampusDuration = z.infer<typeof duration>

const campusInfo = z.string().trim().default('')
export type CampusInfo = z.infer<typeof campusInfo>

const campusExperienceFields = { experienceName, role, duration, campusInfo }

export const campusExperienceFormSchema = createExperienceSchema(campusExperienceFields)

export type CampusExperienceFormType = z.infer<typeof campusExperienceFormSchema>
export type CampusExperienceItem = CampusExperienceFormType['items'][number]

export const DEFAULT_CAMPUS_EXPERIENCE: CampusExperienceFormType = {
  items: [
    {
      entryId: 'default_campus_experience_1',
      hidden: false,
      experienceName: '',
      role: '',
      duration: ['', ''],
      campusInfo: '',
    },
  ],
}
