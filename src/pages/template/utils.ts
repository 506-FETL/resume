import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { TEMPLATE_CATEGORIES } from './const'

export function catalogTemplateRef(item: TemplateCatalogItem) {
  return { templateId: item.templateId, templateVersion: item.currentVersion }
}

export function matchesTemplateFilters(item: TemplateCatalogItem, style: string | null, layout: string | null) {
  const category = TEMPLATE_CATEGORIES[item.templateId]
  return (!style || category?.style === style) && (!layout || category?.layout === layout)
}
