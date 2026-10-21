import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'

export function catalogTemplateRef(item: TemplateCatalogItem) {
  return { templateId: item.templateId, templateVersion: item.currentVersion }
}
