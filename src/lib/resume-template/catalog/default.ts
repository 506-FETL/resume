import type { TemplateCatalogItem } from '../source/types'

export const defaultTemplateCatalogItem: TemplateCatalogItem = {
  templateId: 'default',
  name: '默认模板',
  description: '清晰的单栏排版，适合展示教育、工作与项目经历。',
  currentVersion: 1,
  category: { style: '简约', layout: '单栏' },
  defaultExample: { exampleId: 'graduate', version: 1 },
  examples: [
    { exampleId: 'graduate', version: 1, name: '应届生示例', description: '突出教育、实习与校园经历' },
    { exampleId: 'frontend', version: 1, name: '前端开发示例', description: '突出工作、项目与专业技能' },
  ],
}
