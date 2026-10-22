import type { TemplateDefinition } from './definition-schema'
import { z } from 'zod'
import { parseTemplateDefinition, TemplateResolutionError } from './definition-schema'

export interface PublishedTemplateManifest {
  schemaVersion: 2
  templateId: string
  templateVersion: number
  definition: TemplateDefinition
  assets: TemplateDefinition['assets']
}
const envelope = z.object({
  schemaVersion: z.literal(2),
  templateId: z.string(),
  templateVersion: z.number().int().positive(),
  definition: z.unknown(),
  assets: z.array(z.unknown()).max(32),
}).strict()

export function parseSharedTemplateDefinition(input: unknown): TemplateDefinition {
  const parsed = envelope.safeParse(input)
  if (!parsed.success)
    throw new TemplateResolutionError('INVALID_DEFINITION', '分享模板快照无效')
  const definition = parseTemplateDefinition(parsed.data.definition)
  if (parsed.data.templateId !== definition.templateId || parsed.data.templateVersion !== definition.version
    || JSON.stringify(parsed.data.assets) !== JSON.stringify(definition.assets)) {
    throw new TemplateResolutionError('REFERENCE_MISMATCH', '分享模板快照版本或素材清单不一致')
  }
  return definition
}

export function serializeTemplateForShare(input: TemplateDefinition): PublishedTemplateManifest {
  const definition = parseTemplateDefinition(input)
  return structuredClone({ schemaVersion: 2, templateId: definition.templateId, templateVersion: definition.version, definition, assets: structuredClone(definition.assets) })
}
