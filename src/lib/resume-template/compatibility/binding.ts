import type { ResumeTemplateBinding } from '@/lib/schema/resume/persisted'
import type { TemplateRef } from '../definition-schema'
import { templateRefSchema, TemplateResolutionError } from '../definition-schema'

export const DEFAULT_TEMPLATE_REF: Readonly<TemplateRef> = Object.freeze({ templateId: 'default', templateVersion: 1 })

/** 读取适配不改写正文、历史或分享快照。明确的新引用绝不静默回退。 */
export function resolveTemplateReference(binding: unknown): TemplateRef {
  if (binding == null)
    return { ...DEFAULT_TEMPLATE_REF }
  if (typeof binding !== 'object' || Array.isArray(binding))
    throw new TemplateResolutionError('INVALID_BINDING', '简历模板引用无效')

  const record = binding as Record<string, unknown>
  const validSource = ['official', 'user', 'community'].includes(String(record.source))
  if (!validSource || typeof record.templateId !== 'string' || !record.templateId.trim())
    throw new TemplateResolutionError('INVALID_BINDING', '简历模板引用无效')
  if (!Object.prototype.hasOwnProperty.call(record, 'templateVersion'))
    return { ...DEFAULT_TEMPLATE_REF }

  const parsed = templateRefSchema.safeParse({ templateId: record.templateId, templateVersion: record.templateVersion })
  if (record.source !== 'official' || !parsed.success)
    throw new TemplateResolutionError('INVALID_BINDING', '简历模板版本无效')
  return parsed.data
}

export function toTemplateBinding(ref: TemplateRef): ResumeTemplateBinding {
  return { source: 'official', ...templateRefSchema.parse(ref) }
}
