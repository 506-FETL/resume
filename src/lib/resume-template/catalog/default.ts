import type { TemplateCatalogItem } from '../source/types'

export const defaultTemplateCatalogItem: TemplateCatalogItem = {
  templateId: 'default',
  name: '默认模板',
  description: '清晰的单栏排版，适合展示教育、工作与项目经历。',
  currentVersion: 1,
  defaultExample: { exampleId: 'graduate', version: 1 },
  examples: [{ exampleId: 'graduate', version: 1 }, { exampleId: 'frontend', version: 1 }],
}
