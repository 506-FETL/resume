import type { TemplateRef } from './definition-schema'
import type { ResumeTemplateBinding } from '@/lib/schema/resume/persisted'
import { resolveResumeTemplateBinding } from '@/lib/schema/resume/persisted'
import { templateRefSchema, TemplateResolutionError } from './definition-schema'

export function resolveTemplateReference(binding: unknown): TemplateRef {
  try {
    const value = resolveResumeTemplateBinding(binding)
    return templateRefSchema.parse({ templateId: value.templateId, templateVersion: value.templateVersion })
  }
  catch {
    throw new TemplateResolutionError('INVALID_BINDING', '简历模板引用无效，请从模板库新建简历')
  }
}

export function toTemplateBinding(ref: TemplateRef): ResumeTemplateBinding {
  return { source: 'official', ...templateRefSchema.parse(ref) }
}
