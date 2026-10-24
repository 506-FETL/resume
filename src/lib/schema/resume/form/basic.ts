import { z } from 'zod'
import { resumePhotoSchema } from './photo'

const genderSchema = z.enum(['不填', '男', '女', '其他']).default('不填')
export type Gender = z.infer<typeof genderSchema>
const maritalStatusSchema = z
  .enum(['不填', '未婚', '已婚', '离异', '已婚已育'])
  .default('不填')
export type MaritalStatus = z.infer<typeof maritalStatusSchema>
const politicalStatusSchema = z
  .enum(['不填', '中共党员', '中共预备党员', '共青团员', '群众', '其他'])
  .default('不填')
export type PoliticalStatus = z.infer<typeof politicalStatusSchema>
const workYearsSchema = z
  .enum(['不填', '应届', '1年', '2年', '3-5年', '5-10年', '10年以上'])
  .default('不填')
export type WorkYears = z.infer<typeof workYearsSchema>

const customFieldSchema = z
  .object({
    label: z.string().trim(),
    value: z.string().trim(),
  })
  .optional()
export type BasicCustomField = z.infer<typeof customFieldSchema>

export const basicsSchema = z.object({
  photo: resumePhotoSchema.nullable().default(null),
  name: z.string().trim(),
  gender: genderSchema,
  birthMonth: z.string(),
  phone: z.string().trim(),
  email: z.string(),
  workYears: workYearsSchema,
  maritalStatus: maritalStatusSchema,
  heightCm: z.number().int(),
  weightKg: z.number().int(),
  nation: z.string().trim(),
  nativePlace: z.string().trim(),
  customFields: z.array(customFieldSchema).default([]),
  politicalStatus: politicalStatusSchema,
})

export type BasicFormType = z.infer<typeof basicsSchema>
export type BasicFormInput = z.input<typeof basicsSchema>

export const DEFAULT_BASICS: BasicFormType = {
  photo: null,
  name: 'Granular Resume',
  gender: '不填',
  birthMonth: '',
  phone: '',
  email: '',
  workYears: '不填',
  maritalStatus: '不填',
  heightCm: 0,
  weightKg: 0,
  nation: '',
  nativePlace: '',
  politicalStatus: '不填',
  customFields: [],
}
