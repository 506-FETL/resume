import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import type { PersistedResumeSnapshot, ResumeTemplateBinding } from '@/lib/schema'

export function templateBindingKey(binding: ResumeTemplateBinding | null | undefined): string {
  return binding ? `${binding.source}:${binding.templateId}@${binding.templateVersion}` : ''
}

export function sameTemplateBinding(a: ResumeTemplateBinding | null | undefined, b: ResumeTemplateBinding | null | undefined): boolean {
  return templateBindingKey(a) === templateBindingKey(b)
}

export function templateSwitchReferenceDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 直接保留完整签名，避免短哈希碰撞允许过期预览写入。 */
export function createTemplateSwitchContentKey(snapshot: PersistedResumeSnapshot, binding: ResumeTemplateBinding, referenceDate = templateSwitchReferenceDate()): string {
  const { templateBinding: _binding, ...content } = snapshot
  return JSON.stringify([templateBindingKey(binding), referenceDate, content])
}

/** 只检查实际渲染树，包括 region 的覆盖树，不从模板名称推断能力。 */
export function templateHasPhoto(definition: TemplateDefinition): boolean {
  function containsPhoto(value: unknown): boolean {
    if (!value || typeof value !== 'object')
      return false
    if (Array.isArray(value))
      return value.some(containsPhoto)
    const node = value as Record<string, unknown>
    return node.type === 'photo' || Object.values(node).some(containsPhoto)
  }
  return definition.page.regions.some(region => [
    region.document ?? definition.document,
    region.section ?? definition.section,
    ...Object.keys(definition.contentByKind).map(kind => region.contentByKind?.[kind as keyof typeof definition.contentByKind] ?? definition.contentByKind[kind as keyof typeof definition.contentByKind]),
  ].some(containsPhoto))
}
