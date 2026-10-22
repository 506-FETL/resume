import type { TemplateDefinition } from '../definition-schema'
import type { TemplateSource } from '../source/types'
import { resolveTemplateReference } from '../compatibility/binding'
import { parseTemplateDefinition, TemplateResolutionError } from '../definition-schema'

export async function resolveTemplate(source: TemplateSource, binding: unknown): Promise<TemplateDefinition> {
  const ref = resolveTemplateReference(binding)
  const definition = parseTemplateDefinition(await source.getTemplateVersion(ref))
  if (definition.templateId !== ref.templateId || definition.version !== ref.templateVersion)
    throw new TemplateResolutionError('REFERENCE_MISMATCH', '模板版本与请求不一致')
  return definition
}
