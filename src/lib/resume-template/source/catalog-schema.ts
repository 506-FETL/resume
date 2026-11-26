import { z } from 'zod'
import { templateIdSchema } from '../identity'

export const exampleRefSchema = z
  .object({ exampleId: templateIdSchema, version: z.number().int().positive() })
  .strict()

export const catalogQuerySchema = z.object({
  offset: z.number().int().min(0).max(100000).default(0),
  style: z.string().min(1).max(60).nullable().optional(),
  layout: z.string().min(1).max(60).nullable().optional(),
})

export const assetRefSchema = z
  .object({
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum(['image/png', 'image/webp', 'image/jpeg']),
    byteLength: z.number().int().positive().max(524288),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
  })
  .strict()

export const catalogFacetsSchema = z
  .object({
    styles: z.array(z.string().max(60)).max(500),
    layouts: z.array(z.string().max(60)).max(500),
  })
  .strict()
