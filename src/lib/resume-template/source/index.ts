// 数据源唯一装配入口；远端阶段在此替换实现，消费者继续使用 TemplateSource 契约。
export { localTemplateSource as resumeTemplateSource } from './local'
export type { ExampleRef, ResumeExample, TemplateCatalogItem, TemplateSource } from './types'
