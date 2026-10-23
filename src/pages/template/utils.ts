import type { ExampleRef, TemplateCatalogItem } from '@/lib/resume-template/source/types'

import { templateKey } from '@/lib/resume-template/source/types'
import { useResumeTemplateStore } from '@/store/resume-template'
import { useTemplateImageStore } from '@/store/resume-template/images'

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

// 只在用户表达打开意图时预取，列表仍只按可视范围加载缩略图。
export async function prefetchTemplatePreview(item: TemplateCatalogItem, example: ExampleRef) {
  const resources = useResumeTemplateStore.getState()
  const ref = catalogTemplateRef(item)
  const imageStore = useTemplateImageStore.getState()
  const preview = item.previews.find(candidate => candidate.templateVersion === item.currentVersion && candidate.example.exampleId === example.exampleId && candidate.example.version === example.version)
  if (preview)
    imageStore.load(preview.asset)
  await Promise.all([resources.loadDefinition(ref), resources.loadExample(example)])
  const definition = useResumeTemplateStore.getState().definitions[templateKey(ref)]
  if (definition?.status === 'ready') {
    await Promise.all(definition.data.assets.map(asset => imageStore.load({ hash: asset.sha256, byteLength: asset.bytes, mimeType: asset.mimeType, width: asset.width, height: asset.height })))
  }
}
