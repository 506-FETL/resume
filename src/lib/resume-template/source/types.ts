import type { TemplateDefinition, TemplateRef } from '../definition-schema'
import type { PersistedResumeSnapshot, ResumeSchema } from '@/lib/schema'

export interface ExampleRef { exampleId: string, version: number }
export interface ExampleOption extends ExampleRef { name: string, description: string }
export interface ResumeExample {
  exampleId: string
  version: number
  name: string
  projectionReferenceDate: string
  content: Pick<PersistedResumeSnapshot, keyof ResumeSchema | 'order' | 'visibility'>
}
export interface TemplateAssetRef { hash: string, mimeType: 'image/png' | 'image/webp' | 'image/jpeg', byteLength: number, width: number, height: number }
export interface TemplatePreview {
  templateId: string
  templateVersion: number
  example: ExampleRef
  appearance: TemplateDefinition['appearanceDefaults']
  projectionReferenceDate: string
  asset: TemplateAssetRef
}
export interface TemplateCatalogItem {
  schemaVersion: 3
  renderContract: 'declarative-page@1'
  previews: TemplatePreview[]
  templateId: string
  name: string
  description: string
  currentVersion: number
  category: { style: string, layout: string }
  defaultExample: ExampleRef
  examples: ExampleOption[]
}
export interface CatalogQuery { offset?: number, style?: string | null, layout?: string | null }
export interface CatalogPage { items: TemplateCatalogItem[], nextOffset: number | null }
export interface CatalogFacets { styles: string[], layouts: string[] }
export interface ResourceOptions { force?: boolean }
export interface TemplateSource {
  getTemplateName: (templateId: string, options?: ResourceOptions) => Promise<string | null>
  listTemplates: () => Promise<TemplateCatalogItem[]>
  listTemplatePage: (query?: CatalogQuery, options?: ResourceOptions) => Promise<CatalogPage>
  getCatalogFacets: (options?: ResourceOptions) => Promise<CatalogFacets>
  getTemplateVersion: (ref: TemplateRef, options?: ResourceOptions) => Promise<TemplateDefinition>
  getAsset: (ref: TemplateAssetRef, options?: ResourceOptions) => Promise<Blob>
  retainResource: (key: string) => () => void
  getExample: (ref: ExampleRef, options?: ResourceOptions) => Promise<ResumeExample>
}
export const CATALOG_PAGE_SIZE = 12
export function templateKey(ref: TemplateRef): string {
  return `${ref.templateId}@${ref.templateVersion}`
}
export function exampleKey(ref: ExampleRef): string {
  return `${ref.exampleId}@${ref.version}`
}
export function catalogQueryKey(query: CatalogQuery = {}): string {
  return JSON.stringify([query.style || null, query.layout || null, query.offset ?? 0])
}
