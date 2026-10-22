import { createTemplateCache } from './cache'
import { createRemoteTemplateSource } from './remote'
import { createTemplateTransport } from './transport'

// 唯一装配入口。运行时仅从官方远程资源读取已发布的精确版本。
const projectUrl = import.meta.env.VITE_SUPABASE_URL
export const resumeTemplateSource = createRemoteTemplateSource({
  transport: createTemplateTransport(projectUrl, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  cache: createTemplateCache(projectUrl),
})
export type { CatalogFacets, CatalogPage, CatalogQuery, ExampleRef, ResumeExample, TemplateCatalogItem, TemplateSource } from './types'
