import { publicTemplateResources } from './public-resources'
import { createRemoteTemplateSource } from './remote'

export { getTemplatePreviewUrl } from './preview-url'

export const resumeTemplateSource = createRemoteTemplateSource(
  publicTemplateResources,
)

export type {
  CatalogFacets,
  CatalogPage,
  CatalogQuery,
  ExampleRef,
  ResumeExample,
  TemplateCatalogItem,
  TemplateSource,
} from './types'
