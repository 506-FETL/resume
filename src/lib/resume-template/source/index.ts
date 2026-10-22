import { createTemplateCache } from './cache'
import { createRemoteTemplateSource } from './remote'
import { createTemplateTransport } from './transport'

// 唯一装配入口。线上为真源；本地定义仅用于种子迁移及旧分享兼容。
const projectUrl = import.meta.env.VITE_SUPABASE_URL
export const resumeTemplateSource = createRemoteTemplateSource({
  transport: createTemplateTransport(projectUrl, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  cache: createTemplateCache(projectUrl),
})
export type { CatalogFacets, CatalogPage, CatalogQuery, ExampleRef, ResumeExample, TemplateCatalogItem, TemplateSource } from './types'
