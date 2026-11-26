import CachedPreview from '../cached-preview'
import {
  keepPreviewPaper,
  readPreviewPaper,
  previewViewport,
} from '../../store/preview-paper'
import { useTemplateImageStore } from '@/store/resume-template/images'
import type { ResumeDocumentStateChange } from '@/components/resume/pagination/types'
import type {
  ExampleRef,
  TemplateCardSummary,
} from '@/lib/resume-template/source/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import TemplateResourceStatus from '@/components/resume/template-resource-status'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'
import { toTemplateBinding } from '@/lib/resume-template/binding'
import { useTemplateExample } from '../../hooks/use-template-example'
import { useTemplatePreview } from '../../hooks/use-template-preview'
import { usePreviewReady } from '../../hooks/use-preview-ready'
import { catalogTemplateRef } from '../../utils.ts'

interface PreviewProps {
  item: TemplateCardSummary
  example: ExampleRef
  preview?: TemplateCardSummary['defaultPreview']
}

export default function ExamplePreview({
  item,
  example,
  preview,
}: PreviewProps) {
  const key = `${item.templateId}@${item.currentVersion}:${example.exampleId}@${example.version}`
  const [paper, setPaper] = useState(() => readPreviewPaper(key))

  useEffect(() => {
    if (!paper) return

    const resize = () => {
      if (paper.viewport !== previewViewport()) setPaper(undefined)
    }

    window.addEventListener('resize', resize)

    return () => window.removeEventListener('resize', resize)
  }, [paper])

  return paper?.key === key ? (
    <CachedPreview paper={paper} />
  ) : (
    <LivePreview item={item} example={example} preview={preview} />
  )
}

function LivePreview({ item, example, preview }: PreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const ready = usePreviewReady(previewRef)

  return (
    <div ref={previewRef}>
      <PreviewDocument
        item={item}
        example={example}
        preview={preview}
        renderDocument={ready}
      />
    </div>
  )
}

function PreviewDocument({
  item,
  example,
  renderDocument,
  preview,
}: PreviewProps & {
  renderDocument: boolean
}) {
  const { resource, retry } = useTemplateExample(example)

  const template = useResolvedResumeTemplate({
    binding: toTemplateBinding(catalogTemplateRef(item)),
  })

  const data = useMemo(
    () =>
      renderDocument && resource?.status === 'ready'
        ? buildTemplateResumeData({ ...resource.data.content, type: 'default' })
        : null,
    [resource, renderDocument],
  )

  const thumbnail = useTemplatePreview(preview, true)
  const contentKey = `${item.templateId}@${item.currentVersion}:${example.exampleId}@${example.version}`
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const pagesRef = useRef<HTMLDivElement>(null)

  const definition =
    template.resource.status === 'ready' ? template.resource.data : undefined

  const onDocumentStateChange = useCallback<ResumeDocumentStateChange>(
    (state) => {
      const pages = pagesRef.current

      if (
        state.status === 'ready' &&
        pages?.offsetWidth &&
        definition &&
        template.assetUrls.size === definition.assets.length
      ) {
        const release = definition.assets.map((asset) =>
          useTemplateImageStore.getState().retain(asset.sha256),
        )

        keepPreviewPaper(contentKey, pages, () =>
          release.forEach((done) => done()),
        )
      }
      if (state.status === 'ready' || state.status === 'error')
        setRevealedKey(contentKey)
    },
    [contentKey, definition, template.assetUrls],
  )

  // 冷启动完整排版时复用已展示的首页；失败仍展示真实错误和重试入口。
  if (
    thumbnail.url &&
    resource?.status !== 'error' &&
    template.resource.status !== 'error' &&
    (!renderDocument ||
      resource?.status !== 'ready' ||
      template.resource.status !== 'ready')
  )
    return (
      <img
        src={thumbnail.url}
        alt={`${item.name}首页预览`}
        width={preview?.asset.width}
        height={preview?.asset.height}
        className='h-auto w-full'
      />
    )
  if (resource?.status !== 'ready' || !data)
    return (
      <TemplateResourceStatus
        error={
          resource?.status === 'error' ? resource.error.message : undefined
        }
        onRetry={retry}
      />
    )
  if (template.resource.status !== 'ready')
    return (
      <TemplateResourceStatus
        error={
          template.resource.status === 'error'
            ? template.resource.error.message
            : undefined
        }
        onRetry={template.retry}
      />
    )

  const showThumbnail = Boolean(thumbnail.url && revealedKey !== contentKey)

  return (
    <div className='relative'>
      {showThumbnail && (
        <img
          src={thumbnail.url}
          alt={`${item.name}首页预览`}
          width={preview?.asset.width}
          height={preview?.asset.height}
          className='h-auto w-full'
        />
      )}
      <div
        className={
          showThumbnail
            ? 'pointer-events-none absolute inset-x-0 top-0 opacity-0'
            : undefined
        }
        aria-hidden={showThumbnail || undefined}
      >
        <ScaledReadonlyPreview
          documentRef={pagesRef}
          data={data}
          definition={template.resource.data}
          assetUrls={template.assetUrls}
          appearance={template.resource.data.appearanceDefaults}
          projectionReferenceDate={resource.data.projectionReferenceDate}
          onDocumentStateChange={onDocumentStateChange}
        />
      </div>
    </div>
  )
}
