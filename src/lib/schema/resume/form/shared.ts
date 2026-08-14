import { z } from 'zod'
import { resumeEntryIdSchema } from '../entry-id'

export const durationField = z.array(z.string().trim()).length(2)

export function createExperienceSchema<T extends z.ZodRawShape>(fields: T) {
  return z.object({
    items: z.array(z.object({
      entryId: resumeEntryIdSchema,
      ...fields,
    })),
  })
}
