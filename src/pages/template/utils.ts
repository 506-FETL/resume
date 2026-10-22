import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'

export function catalogTemplateRef(item: TemplateCatalogItem) {
  return { templateId: item.templateId, templateVersion: item.currentVersion }
}

export function templateScrollRoot(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent) {
    if (/auto|scroll|overlay/.test(getComputedStyle(parent).overflowY))
      return parent
    parent = parent.parentElement
  }
  return null
}
