import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

export const durationField = z.array(z.string().trim()).length(2)

// 条目级显隐：true = 隐藏（与板块级 visibility 语义一致），默认不隐藏
export const hiddenField = z.boolean().optional().default(false)

export function createExperienceSchema<T extends z.ZodRawShape>(fields: T) {
  return z.object({
    items: z.array(z.object({
      entryId: resumeEntryIdSchema,
      hidden: hiddenField,
      ...fields,
    })),
  })
}
