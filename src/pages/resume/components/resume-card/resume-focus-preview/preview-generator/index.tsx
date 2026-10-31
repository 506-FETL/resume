import type { PersistedResumeSnapshot } from '@/lib/schema'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import type { ResumePreviewPaper } from '../../../../store/preview-types'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import ScaledReadonlyPreview from '@/components/resume/scaled-readonly-preview'
import { buildTemplateResumeData } from '@/components/resume/runtime/context/resume-data-context'
import { useResolvedResumeTemplate } from '@/hooks/use-resolved-resume-template'

export default function PreviewGenerator({
  snapshot,
  signal,
  retry,
  onReady,
  onError,
}: {
  snapshot: PersistedResumeSnapshot
  signal: AbortSignal
  retry: boolean
  onReady: (paper: ResumePreviewPaper) => void
  onError: (error: unknown) => void
}) {
  const documentRef = useRef<HTMLDivElement>(null)
  const capturingRef = useRef(false)
  const retriedRef = useRef(false)
  const data = useMemo(() => buildTemplateResumeData(snapshot), [snapshot])

  const {
    resource,
    retry: retryTemplate,
    assetUrls,
  } = useResolvedResumeTemplate({
    binding: snapshot.templateBinding,
  })

  useEffect(() => {
    if (resource.status !== 'error') return

    if (retry && !retriedRef.current && retryTemplate) {
      retriedRef.current = true
      retryTemplate().catch(onError)

      return
    }

    onError(resource.error)
  }, [onError, retry, resource, retryTemplate])

  const setMeasurementSource = useCallback((source: HTMLDivElement | null) => {
    if (source) source.inert = true
  }, [])

  const onDocumentStateChange = useCallback(
    (state: ResumeDocumentState) => {
      if (state.status === 'error') {
        onError(new Error(state.error ?? '预览排版失败'))

        return
      }
      if (state.status !== 'ready' || capturingRef.current) return

      const page =
        documentRef.current?.querySelector<HTMLElement>('[data-resume-page]')

      if (!page) {
        onError(new Error('预览未生成纸页'))

        return
      }

      capturingRef.current = true

      capturePaper(page, signal).then(onReady, onError)
    },
    [onError, onReady, signal],
  )

  if (resource.status !== 'ready') return null

  return (
    <ScaledReadonlyPreview
      data={data}
      appearance={snapshot}
      definition={resource.data}
      assetUrls={assetUrls}
      documentRef={documentRef}
      sourceRef={setMeasurementSource}
      onDocumentStateChange={onDocumentStateChange}
    />
  )
}

async function capturePaper(
  page: HTMLElement,
  signal: AbortSignal,
): Promise<ResumePreviewPaper> {
  const clone = page.cloneNode(true) as HTMLElement
  const style = getComputedStyle(page)
  const width = parseFloat(style.width)
  const height = parseFloat(style.height)
  const objectUrls: string[] = []

  clone
    .querySelectorAll('[data-resume-comment-ui]')
    .forEach((node) => node.remove())

  const attributes = [clone, ...clone.querySelectorAll('*')].flatMap(
    (element) =>
      [...element.attributes].filter((attribute) =>
        attribute.value.includes('blob:'),
      ),
  )

  const urls = new Set(
    attributes.flatMap(
      (attribute) => attribute.value.match(/blob:[^"'\s)<>]+/g) ?? [],
    ),
  )

  let bytes = 0

  try {
    // 模板资源会在引擎卸载后释放；成品持有自己的 URL，直到缓存淘汰。
    for (const url of urls) {
      const response = await fetch(url, { signal })
      const blob = await response.blob()

      signal.throwIfAborted()

      const ownedUrl = URL.createObjectURL(blob)

      objectUrls.push(ownedUrl)
      bytes += blob.size

      for (const attribute of attributes)
        attribute.value = attribute.value.replaceAll(url, ownedUrl)
    }

    signal.throwIfAborted()

    const html = clone.outerHTML

    bytes += html.length * 2

    page.querySelectorAll('img').forEach((image) => {
      bytes += image.naturalWidth * image.naturalHeight * 4
    })

    return { html, width, height, objectUrls, bytes }
  } catch (error) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url))

    throw error
  }
}
