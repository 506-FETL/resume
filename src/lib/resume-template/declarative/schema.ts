import type { TemplateDefinition, TemplateNode, TemplateStyle } from './types'
import { z } from 'zod'
import { fontConfigSchema } from '@/lib/schema/resume/config/font'
import { spacingConfigSchema } from '@/lib/schema/resume/config/spacing'
import { themeConfigSchema } from '@/lib/schema/resume/config/theme'
import { isSafeTemplatePath } from './svg-path'

export const templateIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
export const templateRefSchema = z.object({ templateId: templateIdSchema, templateVersion: z.number().int().positive() }).strict()
const identifier = z.string().regex(/^[a-z][a-z0-9-]*$/i).max(80)
const numericTokens = ['pageMargin', 'fontSize', 'nameSize', 'contentSize', 'smallSize', 'lineHeight', 'sectionSpacing', 'entrySpacing', 'paragraphSpacing', 'normalWeight', 'mediumWeight', 'boldWeight'] as const
const numeric = z.union([z.number().finite().min(0).max(4096), z.object({ token: z.enum(numericTokens), factor: z.number().finite().min(0).max(10).optional(), add: z.number().finite().min(-256).max(256).optional() }).strict()])
const hex = z.string().regex(/^#[\da-f]{6}$/i) as z.ZodType<`#${string}`>
export const colorSchema = z.union([hex, z.object({ token: z.enum(['primary', 'accent', 'text', 'secondary', 'muted', 'track', 'badge']) }).strict()])
const marginNumeric = z.union([z.number().finite().min(-256).max(4096), numeric])
const numericProperties = ['fontSize', 'fontWeight', 'lineHeight', 'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'letterSpacing', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap', 'columnGap', 'rowGap', 'width', 'height', 'minWidth', 'maxWidth', 'flexGrow', 'flexShrink'] as const
export const templateStyleSchema = z.object({
  ...Object.fromEntries(numericProperties.map(property => [property, (property.startsWith('margin') ? marginNumeric : numeric).optional()])),
  opacity: z.number().finite().min(0).max(1).optional(),
  rotate: z.number().finite().min(-12).max(12).optional(),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  boxShadow: z.object({ x: z.number().finite().min(-24).max(24), y: z.number().finite().min(-24).max(24), blur: z.number().finite().min(0).max(32), spread: z.number().finite().min(-16).max(16), color: colorSchema, opacity: z.number().finite().min(0).max(1) }).strict().optional(),
  color: colorSchema.optional(),
  backgroundColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  alignItems: z.enum(['start', 'center', 'end', 'baseline', 'stretch']).optional(),
  justifyContent: z.enum(['start', 'center', 'end', 'space-between']).optional(),
  whiteSpace: z.enum(['normal', 'pre-wrap', 'nowrap']).optional(),
  columns: z.array(z.number().positive().max(20)).min(1).max(6).optional(),
}).strict() as z.ZodType<TemplateStyle>
const coordinate = z.number().finite().min(-4096).max(4096)
const dimension = z.number().finite().min(0).max(4096)
const shapePaint = { opacity: z.number().finite().min(0).max(1).optional(), fill: colorSchema.optional(), stroke: colorSchema.optional(), strokeWidth: z.number().finite().min(0).max(24).optional() }
const shape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rect'), x: coordinate, y: coordinate, width: dimension, height: dimension, radius: dimension.optional(), ...shapePaint }).strict(),
  z.object({ kind: z.literal('circle'), cx: coordinate, cy: coordinate, radius: dimension, ...shapePaint }).strict(),
  z.object({ kind: z.literal('path'), d: z.string().min(1).max(8192).regex(/^[MZLHVCSQTA\d\s.,+\-]+$/i).refine(isSafeTemplatePath, 'SVG 路径无效'), ...shapePaint }).strict(),
])
const field = z.enum(['profile.name', 'profile.workYears', 'item', 'item.field', 'item.title', 'item.subtitle', 'item.duration'])
const text = z.enum(['section.key', 'section.index', 'item.index', 'item.first', 'item.last', 'item.fieldKey', 'section.title', 'item.label', 'item.percentage', 'item.proficiency'])
const richText = z.enum(['block.richText', 'item.description'])
const list = z.enum(['profile.fields', 'profile.jobIntent', 'profile.meta', 'profile.contact', 'block.items'])
const condition = z.object({ binding: z.union([field, text, richText, list, z.enum(['profile.photo', 'profile', 'sections', 'item.displayType'])]), operator: z.enum(['present', 'equals']), value: z.string().max(160).optional() }).strict()
const base = { id: identifier, style: identifier.optional(), when: condition.optional(), atomic: z.boolean().optional(), keepWithNext: z.boolean().optional(), sectionTarget: z.literal('basics').optional() }
const projection = z.enum(['primary', 'display']).optional()
const layout = z.enum(['stack', 'row', 'wrap', 'grid'])
const viewBox = z.tuple([coordinate, coordinate, z.number().positive().max(4096), z.number().positive().max(4096)])
export const templateNodeSchema: z.ZodType<TemplateNode> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('box'), layout, children: z.array(templateNodeSchema).max(512), decoration: z.array(shape).max(32).optional(), viewBox: viewBox.optional() }).strict(),
  z.object({ ...base, type: z.literal('text'), text: z.string().max(1000).optional(), binding: text.optional(), map: z.record(z.string().max(80), z.string().max(200)).refine(value => Object.keys(value).length <= 40).optional(), format: z.literal('pad2').optional() }).strict(),
  z.object({ ...base, type: z.literal('field'), binding: field, projection, showLabel: z.boolean().optional(), suffix: z.string().max(40).optional() }).strict(),
  z.object({ ...base, type: z.literal('richText'), binding: richText, projection }).strict(),
  z.object({ ...base, type: z.literal('repeat'), source: list, fieldOrder: z.array(z.string().regex(/^[a-z][a-z0-9]*$/i).max(80)).max(40).optional(), fieldKeys: z.array(z.string().regex(/^[a-z][a-z0-9]*$/i).max(80)).max(40).optional(), separator: z.string().max(40).optional(), layout, children: z.array(templateNodeSchema).max(512) }).strict(),
  z.object({ ...base, type: z.literal('sections') }).strict(),
  z.object({ ...base, type: z.literal('blocks') }).strict(),
  z.object({ ...base, type: z.literal('shape'), viewBox, shapes: z.array(shape).max(32), binding: z.enum(['section.key', 'item.fieldKey']).optional(), variants: z.record(z.string().max(80), z.array(shape).max(32)).refine(value => Object.keys(value).length <= 40).optional() }).strict(),
  z.object({ ...base, type: z.literal('meter'), binding: z.literal('item.percentage'), track: colorSchema, fill: colorSchema }).strict(),
  z.object({ ...base, type: z.literal('photo'), alt: z.string().max(200).optional() }).strict(),
  z.object({ ...base, type: z.literal('image'), asset: identifier, alt: z.string().max(200) }).strict(),
]))
export const templateDefinitionSchema: z.ZodType<TemplateDefinition> = z.object({
  schemaVersion: z.literal(3),
  templateId: templateIdSchema,
  version: z.number().int().positive(),
  renderContract: z.literal('declarative-page@1'),
  page: z.object({
    fullBleed: z.boolean(),
    gap: z.number().finite().min(0).max(100),
    background: colorSchema.optional(),
    decoration: z.array(shape).max(64).optional(),
    decorationFirstPageOnly: z.boolean().optional(),
    pattern: z.object({ kind: z.literal('dots'), color: colorSchema, spacing: z.number().finite().min(4).max(200), radius: z.number().finite().min(0.1).max(8), opacity: z.number().finite().min(0).max(1) }).strict().optional(),
    regions: z.array(z.object({
      id: identifier,
      width: z.number().finite().positive().max(100),
      sections: z.union([z.literal('remaining'), z.array(z.string().max(80)).max(40)]),
      padding: z.tuple([numeric, numeric, numeric, numeric]).optional(),
      background: colorSchema.optional(),
      document: z.array(templateNodeSchema).min(1).max(512).optional(),
      section: z.array(templateNodeSchema).min(1).max(512).optional(),
      contentByKind: z.object({ experience: z.array(templateNodeSchema), richText: z.array(templateNodeSchema), skills: z.array(templateNodeSchema), fieldList: z.array(templateNodeSchema), tagList: z.array(templateNodeSchema) }).partial().strict().optional(),
    }).strict()).min(1).max(2),
  }).strict(),
  capabilities: z.array(z.string().min(1).max(80)).max(24),
  document: z.array(templateNodeSchema).min(1).max(512),
  section: z.array(templateNodeSchema).min(1).max(512),
  contentByKind: z.object({ experience: z.array(templateNodeSchema), richText: z.array(templateNodeSchema), skills: z.array(templateNodeSchema), fieldList: z.array(templateNodeSchema), tagList: z.array(templateNodeSchema) }).strict(),
  styles: z.record(identifier, templateStyleSchema),
  tokens: z.object({ primary: hex, accent: hex }).strict(),
  assets: z.array(z.object({ id: identifier, sha256: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']), bytes: z.number().int().positive().max(512 * 1024), width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096), required: z.boolean() }).strict()).max(32),
  appearanceDefaults: z.object({ theme: themeConfigSchema.strict(), font: fontConfigSchema.strict(), spacing: spacingConfigSchema.strict() }).strict(),
}).strict() as z.ZodType<TemplateDefinition>
