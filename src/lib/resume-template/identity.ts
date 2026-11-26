import { z } from 'zod'

export const templateIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80)

export const templateRefSchema = z
  .object({
    templateId: templateIdSchema,
    templateVersion: z.number().int().positive(),
  })
  .strict()
