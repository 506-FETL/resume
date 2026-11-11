import type { TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { resumeTemplateSource } from '@/lib/resume-template/source'

export type PreviewScenario =
  | 'ready'
  | 'entry-slow'
  | 'entry-error'
  | 'entry-missing'
  | 'image-slow'
  | 'image-error'

let entry: { id: string; scenario: PreviewScenario } | null = null
let image: { hash: string; scenario: PreviewScenario } | null = null

const readEntry =
  resumeTemplateSource.getTemplateCatalogEntry.bind(resumeTemplateSource)

const decode = HTMLImageElement.prototype.decode

resumeTemplateSource.getTemplateCatalogEntry = async (id, options) => {
  const probe = entry?.id === id ? entry : null

  if (probe) {
    entry = null

    if (probe.scenario === 'entry-slow')
      await new Promise((resolve) => setTimeout(resolve, 2200))
    if (probe.scenario === 'entry-error')
      throw new Error('隔离样本模拟目录读取失败')
    if (probe.scenario === 'entry-missing') return null
  }

  return readEntry(id, options)
}

HTMLImageElement.prototype.decode = async function () {
  const probe = image && this.src.includes(image.hash) ? image : null

  if (probe) {
    image = null

    if (probe.scenario === 'image-slow')
      await new Promise((resolve) => setTimeout(resolve, 2200))
    if (probe.scenario === 'image-error')
      throw new Error('隔离样本模拟图片解码失败')
  }

  return decode.call(this)
}

export function preparePreviewScenario(
  item: TemplateCatalogItem,
  scenario: PreviewScenario,
) {
  entry = { id: item.templateId, scenario }

  const preview = item.previews.find(
    (candidate) =>
      candidate.templateVersion === item.currentVersion &&
      candidate.example.exampleId === item.defaultExample.exampleId &&
      candidate.example.version === item.defaultExample.version,
  )

  image = preview ? { hash: preview.asset.hash, scenario } : null
}
