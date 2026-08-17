import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'
import { hiddenField } from './shared'

const schoolName = z.string().trim().default('')
export type SchoolName = z.infer<typeof schoolName>

const professional = z.string().trim().default('')
export type Professional = z.infer<typeof professional>

const degree = z.enum(['不填', '初中', '高中', '中专', '大专', '本科', '学士', '硕士', '博士', 'MBA', 'EMBA', '其他'])
export type Degree = z.infer<typeof degree>

const duration = z.array(z.string().trim()).length(2)
export type EduDuration = z.infer<typeof duration>

const eduInfo = z.string().trim()
export type EduInfo = z.infer<typeof eduInfo>

const eduBackgroundItemSchema = z.object({
  entryId: resumeEntryIdSchema,
  hidden: hiddenField,
  schoolName,
  professional,
  degree,
  duration,
  eduInfo,
})
export type EduBackgroundItem = z.infer<typeof eduBackgroundItemSchema>

const eduBackgroundListSchema = z.array(eduBackgroundItemSchema)

export const eduBackgroundFormSchema = z.object({
  items: eduBackgroundListSchema,
})

export type EduBackgroundFormType = z.infer<typeof eduBackgroundFormSchema>

export const DEFAULT_EDU_BACKGROUND: EduBackgroundFormType = {
  items: [
    {
      entryId: 'default_edu_background_1',
      schoolName: '',
      professional: '',
      degree: '不填',
      duration: ['', ''],
      eduInfo: '',
    },
  ],
}
