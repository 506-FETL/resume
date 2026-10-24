import { z } from 'zod'

const jobIntentSchema = z.string().trim()
export type JobIntent = z.infer<typeof jobIntentSchema>

const intentionalCitySchema = z.string().trim()
export type IntentionalCity = z.infer<typeof intentionalCitySchema>

const expectedSalarySchema = z.number().min(0)
export type ExpectedSalary = z.infer<typeof expectedSalarySchema>

const dateEntrySchema = z.enum([
  '不填',
  '随时到岗',
  '15天内',
  '1个月内',
  '2个月内',
  '3个月内',
  '到岗时间另行商议',
])
export type DateEntry = z.infer<typeof dateEntrySchema>

export const jobIntentFormSchema = z.object({
  jobIntent: jobIntentSchema,
  intentionalCity: intentionalCitySchema,
  expectedSalary: expectedSalarySchema,
  dateEntry: dateEntrySchema,
})

export type JobIntentFormType = z.infer<typeof jobIntentFormSchema>

export const DEFAULT_JOB_INTENT: JobIntentFormType = {
  jobIntent: '',
  intentionalCity: '',
  expectedSalary: 0,
  dateEntry: '不填',
}
