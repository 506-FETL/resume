import { z } from 'zod'

const applicationSchoolSchema = z.string().trim().default('')

export type ApplicationSchool = z.infer<typeof applicationSchoolSchema>

const applicationMajorSchema = z.string().trim().default('')

export type ApplicationMajor = z.infer<typeof applicationMajorSchema>

export const applicationInfoForm = z.object({
  applicationSchool: applicationSchoolSchema,
  applicationMajor: applicationMajorSchema,
})

export type ApplicationInfoFormType = z.infer<typeof applicationInfoForm>

export const DEFAULT_APPLICATION_INFO: ApplicationInfoFormType = {
  applicationSchool: '',
  applicationMajor: '',
}
