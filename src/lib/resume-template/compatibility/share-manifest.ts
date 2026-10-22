import type { TemplateDefinition } from '../definition-schema'
import type { LegacyTemplateManifest } from './legacy-manifest'
import { parseTemplateDefinition, TemplateResolutionError } from '../definition-schema'
import { defaultTemplateV1 } from '../definitions/default/v1'
import { templateManifestSchema } from './legacy-manifest'

export function parseSharedTemplateDefinition(input: unknown): TemplateDefinition {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TemplateResolutionError('INVALID_DEFINITION', '分享模板快照无效')
  const record = input as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(record, 'definition')) {
    const definition = parseTemplateDefinition(record.definition)
    if (record.id !== definition.templateId || record.version !== definition.version)
      throw new TemplateResolutionError('REFERENCE_MISMATCH', '分享模板快照版本不一致')
    return definition
  }
  if (!templateManifestSchema.safeParse(input).success)
    throw new TemplateResolutionError('INVALID_DEFINITION', '旧分享模板快照无效')
  return structuredClone(defaultTemplateV1)
}

/** 保留旧发布接口的信封；视觉定义由冻结的 definition 提供。 */
export type PublishedTemplateManifest = LegacyTemplateManifest & { definition: TemplateDefinition }

export function serializeTemplateForShare(input: TemplateDefinition): PublishedTemplateManifest {
  const definition = parseTemplateDefinition(input)
  const sections = ['basics', 'job_intent', 'application_info', 'education', 'work_experience', 'internship_experience', 'campus_experience', 'project_experience', 'skills', 'honors_certificates', 'self_evaluation', 'hobbies']
  return {
    id: definition.templateId,
    version: definition.version,
    familyId: definition.layout.component === 'single-column@1' ? 'classic-single-column' : definition.layout.component.split('@')[0],
    // 兼容信封不参与新版视觉渲染，分享效果完全由冻结的 definition 决定。
    meta: { name: definition.templateId === 'default' ? '默认模板' : definition.templateId, ownerType: 'official', visibility: 'private', status: 'active' },
    layout: { skeleton: definition.layout.component.split('@')[0], headerVariant: 'default', density: 'normal', page: { size: 'A4', pagePaddingToken: 'md' } },
    sections: sections.map((sectionId, index) => ({ sectionId, renderer: sectionId, region: 'main', order: index + 1, visible: true })),
    tokens: { colorPreset: definition.appearanceDefaults.theme.theme, fontPreset: 'default', spacingPreset: 'default', radiusPreset: 'none' },
    rules: { requiredSections: ['basics'], lockedSections: ['basics'], allowedRegions: Object.fromEntries(sections.map(id => [id, ['main']])) },
    definition,
  }
}
