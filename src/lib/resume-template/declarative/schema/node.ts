import { z } from 'zod'
import { isSafeTemplatePath } from '../svg-path'
import type { TemplateNode } from '../types'
import { RICH_TEXT_STYLE_ELEMENTS } from '../types'
import { colorSchema, identifier } from './style.ts'

export const coordinate = z.number().finite().min(-4096).max(4096)

export const dimension = z.number().finite().min(0).max(4096)

export const shapePaint = {
  opacity: z.number().finite().min(0).max(1).optional(),
  fill: colorSchema.optional(),
  stroke: colorSchema.optional(),
  strokeWidth: z.number().finite().min(0).max(24).optional(),
}

export const shape = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('rect'),
      x: coordinate,
      y: coordinate,
      width: dimension,
      height: dimension,
      radius: dimension.optional(),
      ...shapePaint,
    })
    .strict(),
  z
    .object({
      kind: z.literal('circle'),
      cx: coordinate,
      cy: coordinate,
      radius: dimension,
      ...shapePaint,
    })
    .strict(),
  z
    .object({
      kind: z.literal('path'),
      d: z
        .string()
        .min(1)
        .max(8192)
        .regex(/^[MZLHVCSQTA\d\s.,+\-]+$/i)
        .refine(isSafeTemplatePath, 'SVG 路径无效'),
      ...shapePaint,
    })
    .strict(),
])

export const field = z.enum([
  'profile.name',
  'profile.workYears',
  'item',
  'item.field',
  'item.title',
  'item.subtitle',
  'item.duration',
])

export const text = z.enum([
  'section.key',
  'section.index',
  'item.index',
  'item.first',
  'item.last',
  'item.fieldKey',
  'section.title',
  'item.label',
  'item.percentage',
  'item.proficiency',
])

export const richText = z.enum(['block.richText', 'item.description'])

export const list = z.enum([
  'profile.fields',
  'profile.jobIntent',
  'profile.meta',
  'profile.contact',
  'block.items',
])

export const condition = z
  .object({
    binding: z.union([
      field,
      text,
      richText,
      list,
      z.enum([
        'profile.photo',
        'profile',
        'sections',
        'item.displayType',
        'item.parity',
      ]),
    ]),
    operator: z.enum(['present', 'equals']),
    value: z.string().max(160).optional(),
  })
  .strict()

export const base = {
  id: identifier,
  style: identifier.optional(),
  when: condition.optional(),
  atomic: z.boolean().optional(),
  keepWithNext: z.boolean().optional(),
  sectionTarget: z.literal('basics').optional(),
}

export const projection = z.enum(['primary', 'display']).optional()

export const layout = z.enum(['stack', 'row', 'wrap', 'grid'])

export const viewBox = z.tuple([
  coordinate,
  coordinate,
  z.number().positive().max(4096),
  z.number().positive().max(4096),
])

export const templateNodeSchema: z.ZodType<TemplateNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        ...base,
        type: z.literal('box'),
        layout,
        children: z.array(templateNodeSchema).max(512),
        decoration: z.array(shape).max(32).optional(),
        viewBox: viewBox.optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('text'),
        text: z.string().max(1000).optional(),
        binding: text.optional(),
        map: z
          .record(z.string().max(80), z.string().max(200))
          .refine((value) => Object.keys(value).length <= 40)
          .optional(),
        format: z.literal('pad2').optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('field'),
        binding: field,
        projection,
        showLabel: z.boolean().optional(),
        suffix: z.string().max(40).optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('richText'),
        binding: richText,
        projection,
        elementStyles: z
          .object(
            Object.fromEntries(
              RICH_TEXT_STYLE_ELEMENTS.map((tag) => [
                tag,
                identifier.optional(),
              ]),
            ),
          )
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('repeat'),
        source: list,
        fieldOrder: z
          .array(
            z
              .string()
              .regex(/^[a-z][a-z0-9]*$/i)
              .max(80),
          )
          .max(40)
          .optional(),
        fieldKeys: z
          .array(
            z
              .string()
              .regex(/^[a-z][a-z0-9]*$/i)
              .max(80),
          )
          .max(40)
          .optional(),
        separator: z.string().max(40).optional(),
        layout,
        children: z.array(templateNodeSchema).max(512),
      })
      .strict(),
    z.object({ ...base, type: z.literal('sections') }).strict(),
    z.object({ ...base, type: z.literal('blocks') }).strict(),
    z
      .object({
        ...base,
        type: z.literal('shape'),
        viewBox,
        shapes: z.array(shape).max(32),
        binding: z.enum(['section.key', 'item.fieldKey']).optional(),
        variants: z
          .record(z.string().max(80), z.array(shape).max(32))
          .refine((value) => Object.keys(value).length <= 40)
          .optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('meter'),
        binding: z.literal('item.percentage'),
        track: colorSchema,
        fill: colorSchema,
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('photo'),
        alt: z.string().max(200).optional(),
      })
      .strict(),
    z
      .object({
        ...base,
        type: z.literal('image'),
        asset: identifier,
        alt: z.string().max(200),
      })
      .strict(),
  ]),
)
