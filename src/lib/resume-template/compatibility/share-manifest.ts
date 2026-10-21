import type { TemplateDefinition } from '../definition-schema'
import { parseTemplateDefinition, TemplateResolutionError } from '../definition-schema'
import { defaultTemplateV1 } from '../definitions/default/v1'
import { templateManifestSchema } from '../schema'

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
