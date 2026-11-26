import { z } from 'zod'
import { resumeSchema, visibilityFormsSchema } from '@/lib/schema'
import { fontConfigSchema } from '@/lib/schema/resume/config/font'
import { spacingConfigSchema } from '@/lib/schema/resume/config/spacing'
import { themeConfigSchema } from '@/lib/schema/resume/config/theme'
import { templateIdSchema } from '../definition-schema'
import { CATALOG_PAGE_SIZE } from './types'
import { assetRefSchema, exampleRefSchema } from './catalog-schema'

export {
  assetRefSchema,
  catalogFacetsSchema,
  catalogQuerySchema,
  exampleRefSchema,
} from './catalog-schema'

export const previewSchema = z
  .object({
    templateId: templateIdSchema,
    templateVersion: z.number().int().positive(),
    example: exampleRefSchema,
    appearance: z
      .object({
        theme: themeConfigSchema.strict(),
        font: fontConfigSchema.strict(),
        spacing: spacingConfigSchema.strict(),
      })
      .strict(),
    projectionReferenceDate: z.iso.date(),
    asset: assetRefSchema,
  })
  .strict()

export const catalogItemSchema = z
  .object({
    schemaVersion: z.literal(3),
    renderContract: z.literal('declarative-page@1'),
    previews: z.array(previewSchema).max(30),
    templateId: templateIdSchema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    currentVersion: z.number().int().positive(),
    category: z
      .object({
        style: z.string().min(1).max(60),
        layout: z.string().min(1).max(60),
      })
      .strict(),
    defaultExample: exampleRefSchema,
    examples: z
      .array(
        exampleRefSchema.extend({
          name: z.string().min(1).max(100),
          description: z.string().max(200),
        }),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .refine(
    (item) =>
      item.examples.some(
        (ref) =>
          ref.exampleId === item.defaultExample.exampleId &&
          ref.version === item.defaultExample.version,
      ),
    '默认示例必须在候选列表中',
  )
  .refine(
    (item) =>
      item.previews.every(
        (preview) =>
          preview.templateId === item.templateId &&
          preview.templateVersion === item.currentVersion &&
          item.examples.some(
            (example) =>
              example.exampleId === preview.example.exampleId &&
              example.version === preview.example.version,
          ),
      ),
    '预览必须匹配目录模板和示例的精确版本',
  )
  .refine(
    (item) =>
      new Set(
        item.previews.map(
          (preview) =>
            `${preview.example.exampleId}@${preview.example.version}`,
        ),
      ).size === item.previews.length,
    '同一示例只能有一个目录预览',
  )
  .refine(
    (item) =>
      new Set(
        item.examples.map(
          (example) => `${example.exampleId}@${example.version}`,
        ),
      ).size === item.examples.length,
    '候选示例身份不能重复',
  )
  .refine(
    (item) => item.previews.length === item.examples.length,
    '每个候选示例必须恰有一个目录预览',
  )

export const catalogPageSchema = z
  .object({
    items: z.array(catalogItemSchema).max(CATALOG_PAGE_SIZE),
    nextOffset: z.number().int().nonnegative().nullable(),
  })
  .strict()

export const exampleSchema = z
  .object({
    exampleId: templateIdSchema,
    version: z.number().int().positive(),
    name: z.string().min(1).max(100),
    projectionReferenceDate: z.iso.date(),
    content: resumeSchema
      .extend({
        order: z
          .array(resumeSchema.keyof())
          .length(Object.keys(resumeSchema.shape).length)
          .refine((order) => new Set(order).size === order.length),
        visibility: visibilityFormsSchema.strict(),
      })
      .strict(),
  })
  .strict()

export { decodeResource, resourceEnvelopeSchema } from './resource-envelope'
