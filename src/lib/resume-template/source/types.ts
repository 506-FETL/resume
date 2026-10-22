import type { TemplateDefinition, TemplateRef } from '../definition-schema'
import type { PersistedResumeSnapshot, ResumeSchema } from '@/lib/schema'

export interface ExampleRef { exampleId: string, version: number }
export interface ResumeExample {
  exampleId: string
  version: number
  name: string
  projectionReferenceDate: string
  content: Pick<PersistedResumeSnapshot, keyof ResumeSchema | 'order' | 'visibility'>
}
export interface TemplateCatalogItem {
  templateId: string
  name: string
  description: string
  currentVersion: number
  defaultExample: ExampleRef
  examples: ExampleRef[]
}
export interface TemplateSource {
  listTemplates: () => Promise<TemplateCatalogItem[]>
  getTemplateVersion: (ref: TemplateRef) => Promise<TemplateDefinition>
  getExample: (ref: ExampleRef) => Promise<ResumeExample>
}
export function templateKey(ref: TemplateRef): string {
  return `${ref.templateId}@${ref.templateVersion}`
}
export function exampleKey(ref: ExampleRef): string {
  return `${ref.exampleId}@${ref.version}`
}
