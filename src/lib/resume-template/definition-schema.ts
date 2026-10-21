import { z } from 'zod'
import { fontConfigSchema } from '@/lib/schema/resume/config/font'
import { spacingConfigSchema } from '@/lib/schema/resume/config/spacing'
import { themeConfigSchema } from '@/lib/schema/resume/config/theme'

export const templateIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
export const templateRefSchema = z.object({
  templateId: templateIdSchema,
  templateVersion: z.number().int().positive(),
}).strict()

export const templateDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  templateId: templateIdSchema,
  version: z.number().int().positive(),
  renderContract: z.literal('resume-v1'),
  layout: z.object({
    component: z.literal('single-column@1'),
    sectionOrder: z.literal('resume'),
    sectionVisibility: z.literal('resume'),
  }).strict(),
  header: z.object({
    component: z.literal('centered-profile@1'),
    fieldBinding: z.literal('profile-with-job-intent@1'),
  }).strict(),
  sectionHeading: z.object({ component: z.literal('underline-heading@1') }).strict(),
  contentByKind: z.object({
    experience: z.object({
      component: z.literal('plain-entry-list@1'),
      metaLayout: z.literal('title-subtitle-inline-date-right'),
    }).strict(),
    richText: z.object({ component: z.literal('plain-rich-text@1') }).strict(),
    skills: z.object({ component: z.literal('skill-badges@1') }).strict(),
    fieldList: z.object({ component: z.literal('inline-fields@1'), presentation: z.literal('outlined-tags') }).strict(),
    tagList: z.object({ component: z.literal('tag-list@1') }).strict(),
  }).strict(),
  appearanceDefaults: z.object({
    theme: themeConfigSchema.strict(),
    font: fontConfigSchema.strict(),
    spacing: spacingConfigSchema.strict(),
  }).strict(),
}).strict()

export type TemplateRef = z.infer<typeof templateRefSchema>
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>
export type TemplateErrorCode = 'INVALID_BINDING' | 'INVALID_DEFINITION' | 'VERSION_NOT_FOUND' | 'UNSUPPORTED_CAPABILITY' | 'REFERENCE_MISMATCH' | 'LOAD_FAILED'

export class TemplateResolutionError extends Error {
  readonly code: TemplateErrorCode

  constructor(code: TemplateErrorCode, message: string) {
    super(message)
    this.name = 'TemplateResolutionError'
    this.code = code
  }
}

export function parseTemplateDefinition(input: unknown): TemplateDefinition {
  const parsed = templateDefinitionSchema.safeParse(input)
  if (parsed.success)
    return parsed.data
  const unsupported = parsed.error.issues.some(issue =>
    ['component', 'renderContract', 'schemaVersion', 'fieldBinding'].includes(String(issue.path.at(-1))))
  throw new TemplateResolutionError(
    unsupported ? 'UNSUPPORTED_CAPABILITY' : 'INVALID_DEFINITION',
    unsupported ? '当前应用不支持此模板的呈现方式，请更新应用后重试' : '模板配置无效，请重试或联系维护者',
  )
}

export function asTemplateError(error: unknown): TemplateResolutionError {
  return error instanceof TemplateResolutionError
    ? error
    : new TemplateResolutionError('LOAD_FAILED', '模板资源加载失败，请重试')
}
