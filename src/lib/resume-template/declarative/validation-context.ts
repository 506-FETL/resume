import type { BindingScope } from './binding-registry'
import type { TemplateDefinition } from './types'

export const TEMPLATE_LIMITS = {
  definitionBytes: 256 * 1024,
  nodes: 512,
  depth: 16,
  renderedNodes: 30000,
} as const
export const SUPPORTED_TEMPLATE_CAPABILITIES = [
  'flow',
  'local-grid',
  'vector-shapes',
  'skill-meter',
  'images',
  'page-regions',
  'page-background',
  'photo',
  'display-bindings',
  'item-parity',
  'rich-text-styles',
] as const
export class TemplateValidationError extends Error {
  readonly reason: 'capability' | 'limit' | 'definition'
  constructor(reason: 'capability' | 'limit' | 'definition', message: string) {
    super(message)
    this.reason = reason
  }
}
export function fail(message: string): never {
  throw new TemplateValidationError('definition', message)
}

export interface NodeValidationContext {
  definition: TemplateDefinition
  assets: ReadonlySet<string>
  scope: BindingScope
  hasSection: boolean
}
