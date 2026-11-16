import { fontConfigSchema } from '@/lib/schema/resume/config/font'
import { spacingConfigSchema } from '@/lib/schema/resume/config/spacing'
import { themeConfigSchema } from '@/lib/schema/resume/config/theme'
import { z } from 'zod'
import type { TemplateDefinition } from '../types'
import { shape, templateNodeSchema } from './node.ts'
import {
  colorSchema,
  hex,
  identifier,
  numeric,
  templateIdSchema,
  templateStyleSchema,
} from './style.ts'

export const templateDefinitionSchema: z.ZodType<TemplateDefinition> = z
  .object({
    schemaVersion: z.literal(3),
    templateId: templateIdSchema,
    version: z.number().int().positive(),
    renderContract: z.literal('declarative-page@1'),
    page: z
      .object({
        fullBleed: z.boolean(),
        gap: z.number().finite().min(0).max(100),
        background: colorSchema.optional(),
        decoration: z.array(shape).max(64).optional(),
        decorationFirstPageOnly: z.boolean().optional(),
        pattern: z
          .object({
            kind: z.literal('dots'),
            color: colorSchema,
            spacing: z.number().finite().min(4).max(200),
            radius: z.number().finite().min(0.1).max(8),
            opacity: z.number().finite().min(0).max(1),
          })
          .strict()
          .optional(),
        regions: z
          .array(
            z
              .object({
                id: identifier,
                width: z.number().finite().positive().max(100),
                sections: z.union([
                  z.literal('remaining'),
                  z.array(z.string().max(80)).max(40),
                ]),
                padding: z
                  .tuple([numeric, numeric, numeric, numeric])
                  .optional(),
                background: colorSchema.optional(),
                document: z
                  .array(templateNodeSchema)
                  .min(1)
                  .max(512)
                  .optional(),
                section: z.array(templateNodeSchema).min(1).max(512).optional(),
                contentByKind: z
                  .object({
                    experience: z.array(templateNodeSchema),
                    richText: z.array(templateNodeSchema),
                    skills: z.array(templateNodeSchema),
                    fieldList: z.array(templateNodeSchema),
                    tagList: z.array(templateNodeSchema),
                  })
                  .partial()
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .min(1)
          .max(2),
      })
      .strict(),
    capabilities: z.array(z.string().min(1).max(80)).max(24),
    document: z.array(templateNodeSchema).min(1).max(512),
    section: z.array(templateNodeSchema).min(1).max(512),
    contentByKind: z
      .object({
        experience: z.array(templateNodeSchema),
        richText: z.array(templateNodeSchema),
        skills: z.array(templateNodeSchema),
        fieldList: z.array(templateNodeSchema),
        tagList: z.array(templateNodeSchema),
      })
      .strict(),
    styles: z.record(identifier, templateStyleSchema),
    tokens: z.object({ primary: hex, accent: hex }).strict(),
    assets: z
      .array(
        z
          .object({
            id: identifier,
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
            bytes: z
              .number()
              .int()
              .positive()
              .max(512 * 1024),
            width: z.number().int().positive().max(4096),
            height: z.number().int().positive().max(4096),
            required: z.boolean(),
          })
          .strict(),
      )
      .max(32),
    appearanceDefaults: z
      .object({
        theme: themeConfigSchema.strict(),
        font: fontConfigSchema.strict(),
        spacing: spacingConfigSchema.strict(),
      })
      .strict(),
  })
  .strict() as z.ZodType<TemplateDefinition>
