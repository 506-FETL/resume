import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import type { ExampleRef, TemplateCatalogItem } from '@/lib/resume-template/source/types'
import { useCallback, useMemo, useState } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { toTemplateBinding } from '@/lib/resume-template/binding'
import { useTemplateExample } from '../../hooks/use-template-example'
import { useTemplatePreview } from '../../hooks/use-template-preview'
import { catalogTemplateRef } from '../../utils.ts'

export default function ExamplePreview({ item, example }: { item: TemplateCatalogItem, example: ExampleRef }) {
  const { resource, retry } = useTemplateExample(example)
  const template = useResolvedResumeTemplate({ binding: toTemplateBinding(catalogTemplateRef(item)) })
  const data = useMemo(() => resource?.status === 'ready' ? buildTemplateResumeData({ ...resource.data.content, type: 'default' }) : null, [resource])
  const preview = item.previews.find(candidate => candidate.templateVersion === item.currentVersion && candidate.example.exampleId === example.exampleId && candidate.example.version === example.version)
  const thumbnail = useTemplatePreview(preview, true)
  const contentKey = `${item.templateId}@${item.currentVersion}:${example.exampleId}@${example.version}`
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const onDocumentStateChange = useCallback<ResumeDocumentStateChange>((state) => {
    if (state.status === 'ready' || state.status === 'error')
      setRevealedKey(contentKey)
  }, [contentKey])
  // 冷启动完整排版时复用已展示的首页；失败仍展示真实错误和重试入口。
  if (thumbnail.url && resource?.status !== 'error' && template.resource.status !== 'error' && (resource?.status !== 'ready' || template.resource.status !== 'ready'))
    return <img src={thumbnail.url} alt={`${item.name}首页预览`} width={preview?.asset.width} height={preview?.asset.height} className="h-auto w-full" />
  if (resource?.status !== 'ready' || !data)
    return <TemplateResourceStatus error={resource?.status === 'error' ? resource.error.message : undefined} onRetry={retry} />
  if (template.resource.status !== 'ready')
    return <TemplateResourceStatus error={template.resource.status === 'error' ? template.resource.error.message : undefined} onRetry={template.retry} />
  const showThumbnail = Boolean(thumbnail.url && revealedKey !== contentKey)
  return (
    <div className="relative">
      {showThumbnail && <img src={thumbnail.url} alt={`${item.name}首页预览`} width={preview?.asset.width} height={preview?.asset.height} className="h-auto w-full" />}
      <div className={showThumbnail ? 'pointer-events-none absolute inset-x-0 top-0 opacity-0' : undefined} aria-hidden={showThumbnail || undefined}>
        <ScaledReadonlyPreview data={data} definition={template.resource.data} assetUrls={template.assetUrls} appearance={template.resource.data.appearanceDefaults} projectionReferenceDate={resource.data.projectionReferenceDate} onDocumentStateChange={onDocumentStateChange} />
      </div>
    </div>
  )
}
