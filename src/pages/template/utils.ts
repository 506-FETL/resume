import type {
  ExampleRef,
  TemplateCatalogItem,
} from '@/lib/resume-template/source/types'

import { useResumeTemplateStore } from '@/store/resume-template'

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

// 意图预取只读取必要元数据，完整素材由打开后的真实预览按需加载。
export async function prefetchTemplatePreview(
  item: TemplateCatalogItem,
  example: ExampleRef,
) {
  const resources = useResumeTemplateStore.getState()
  const ref = catalogTemplateRef(item)
  await Promise.all([
    resources.loadDefinition(ref),
    resources.loadExample(example),
  ])
}
