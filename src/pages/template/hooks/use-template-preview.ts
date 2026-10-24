import type { TemplatePreview } from '@/lib/resume-template/source/types'
import { useEffect, useState } from 'react'
import { getTemplatePreviewUrl } from '@/lib/resume-template/source'

export function useTemplatePreview(preview: TemplatePreview | undefined, enabled: boolean) {
  const asset = preview?.asset
  const [retryTarget, setRetryTarget] = useState<{ url: string, attempt: number } | null>(null)
  const [result, setResult] = useState<{ url: string, status: 'ready' | 'error' } | null>(null)
  const canonicalUrl = asset ? getTemplatePreviewUrl(asset) : undefined
  const attempt = retryTarget?.url === canonicalUrl ? retryTarget?.attempt ?? 0 : 0
  const url = canonicalUrl && (attempt ? `${canonicalUrl}?retry=${attempt}` : canonicalUrl)
  const width = asset?.width
  const height = asset?.height
  const current = result?.url === url ? result : null

  useEffect(() => {
    if (!url || !enabled)
      return
    let active = true
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    image.decode().then(() => {
      if (active)
        setResult({ url, status: image.naturalWidth === width && image.naturalHeight === height ? 'ready' : 'error' })
    }, () => {
      if (active)
        setResult({ url, status: 'error' })
    })
    return () => {
      active = false
      image.removeAttribute('src')
    }
  }, [url, enabled, width, height])

  // 浏览器按内容哈希 URL 共享请求与缓存，不再下载 Base64 或创建 Blob URL。
  return {
    status: !asset ? 'missing' : current?.status ?? (enabled ? 'loading' : 'idle'),
    url: current?.status === 'ready' ? current.url : undefined,
    retry: () => {
      if (canonicalUrl)
        setRetryTarget(previous => ({ url: canonicalUrl, attempt: previous?.url === canonicalUrl ? previous.attempt + 1 : 1 }))
    },
  }
}
