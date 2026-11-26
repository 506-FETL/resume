import { useResumeTemplateStore } from '@/store/resume-template'
import { exampleKey } from '@/lib/resume-template/source/types'
import type {
  ExampleRef,
  TemplateCatalogItem,
  TemplateCardSummary,
} from '@/lib/resume-template/source/types'

export function catalogTemplateRef(
  item: Pick<TemplateCatalogItem, 'templateId' | 'currentVersion'>,
) {
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
  item: Pick<TemplateCatalogItem, 'templateId' | 'currentVersion'>,
  example: ExampleRef,
) {
  const resources = useResumeTemplateStore.getState()
  const ref = catalogTemplateRef(item)

  await Promise.all([
    resources.loadDefinition(ref),
    resources.loadExample(example),
  ])
}

export function defaultCardPreview(
  item: TemplateCardSummary,
  example: ExampleRef,
) {
  if (exampleKey(item.defaultExample) === exampleKey(example))
    return item.cardPreview ?? item.defaultPreview
}

export function publishedPreview(
  item: TemplateCatalogItem,
  example: ExampleRef,
  card: TemplateCardSummary | null,
) {
  const small =
    card?.templateId === item.templateId &&
    card.currentVersion === item.currentVersion
      ? defaultCardPreview(card, example)
      : undefined

  return (
    small ??
    item.previews.find(
      (entry) =>
        entry.templateVersion === item.currentVersion &&
        exampleKey(entry.example) === exampleKey(example),
    )
  )
}
