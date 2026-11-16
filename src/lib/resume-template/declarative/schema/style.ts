import { z } from 'zod'
import type { TemplateStyle } from '../types'

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

export const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/i)
  .max(80)

export const numericTokens = [
  'pageMargin',
  'fontSize',
  'nameSize',
  'contentSize',
  'smallSize',
  'lineHeight',
  'sectionSpacing',
  'entrySpacing',
  'paragraphSpacing',
  'normalWeight',
  'mediumWeight',
  'boldWeight',
] as const

export const numeric = z.union([
  z.number().finite().min(0).max(4096),
  z
    .object({
      token: z.enum(numericTokens),
      factor: z.number().finite().min(0).max(10).optional(),
      add: z.number().finite().min(-256).max(256).optional(),
    })
    .strict(),
])

export const hex = z.string().regex(/^#[\da-f]{6}$/i) as z.ZodType<`#${string}`>

export const colorSchema = z.union([
  hex,
  z
    .object({
      token: z.enum([
        'primary',
        'accent',
        'text',
        'secondary',
        'muted',
        'track',
        'badge',
      ]),
    })
    .strict(),
])

export const marginNumeric = z.union([
  z.number().finite().min(-256).max(4096),
  numeric,
])

export const numericProperties = [
  'fontSize',
  'fontWeight',
  'lineHeight',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'letterSpacing',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'columnGap',
  'rowGap',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'flexGrow',
  'flexShrink',
] as const

export const templateStyleSchema = z
  .object({
    ...Object.fromEntries(
      numericProperties.map((property) => [
        property,
        (property.startsWith('margin') ? marginNumeric : numeric).optional(),
      ]),
    ),
    opacity: z.number().finite().min(0).max(1).optional(),
    rotate: z.number().finite().min(-12).max(12).optional(),
    borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    boxShadow: z
      .object({
        x: z.number().finite().min(-24).max(24),
        y: z.number().finite().min(-24).max(24),
        blur: z.number().finite().min(0).max(32),
        spread: z.number().finite().min(-16).max(16),
        color: colorSchema,
        opacity: z.number().finite().min(0).max(1),
      })
      .strict()
      .optional(),
    color: colorSchema.optional(),
    backgroundColor: colorSchema.optional(),
    borderColor: colorSchema.optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    alignItems: z
      .enum(['start', 'center', 'end', 'baseline', 'stretch'])
      .optional(),
    justifyContent: z
      .enum(['start', 'center', 'end', 'space-between'])
      .optional(),
    whiteSpace: z.enum(['normal', 'pre-wrap', 'nowrap']).optional(),
    columns: z.array(z.number().positive().max(20)).min(1).max(6).optional(),
  })
  .strict() as z.ZodType<TemplateStyle>
