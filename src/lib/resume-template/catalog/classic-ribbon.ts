import type { TemplateCatalogItem } from '../source/types'

export const classicRibbonTemplateCatalogItem: TemplateCatalogItem = {
  templateId: 'classic-ribbon',
  name: '经典蓝金模板',
  description: '蓝金配色搭配斜角标题，基本信息与经历分列呈现，清晰展示职业履历。',
  currentVersion: 1,
  category: { style: '经典', layout: '单栏' },
  defaultExample: { exampleId: 'frontend', version: 1 },
  examples: [
    { exampleId: 'graduate', version: 1, name: '应届生示例', description: '突出教育、实习与校园经历' },
    { exampleId: 'frontend', version: 1, name: '前端开发示例', description: '突出工作、项目与专业技能' },
  ],
}
