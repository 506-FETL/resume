import type { TemplatePreview } from '@/lib/resume-template/source/types'
import { useEffect, useMemo, useState } from 'react'
import { getTemplatePreviewUrl } from '@/lib/resume-template/source/preview-url'

const decoded = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

function decodePreview(
  key: string,
  url: string,
  width: number,
  height: number,
) {
  const requestKey = `${key}:${url}`
  const existing = pending.get(requestKey)

  if (existing) return existing

  const image = new Image()

  image.decoding = 'async'
  image.src = url

  const request = image
    .decode()
    .then(() => {
      if (image.naturalWidth !== width || image.naturalHeight !== height)
        throw new Error('缩略图尺寸与发布记录不符')

      // 仅保留不可变图片的校验结果，像素由浏览器管理。
      if (decoded.size >= 128) decoded.delete(decoded.keys().next().value!)

      decoded.set(key, url)

      return url
    })
    .finally(() => pending.delete(requestKey))

  pending.set(requestKey, request)

  return request
}

export function useTemplatePreview(
  preview: Pick<TemplatePreview, 'asset'> | undefined,
  enabled: boolean,
) {
  const asset = preview?.asset

  const canonicalUrl = useMemo(
    () => asset && getTemplatePreviewUrl(asset),
    [asset],
  )

  const width = asset?.width
  const height = asset?.height
  const key = canonicalUrl && `${canonicalUrl}:${width}x${height}`

  const [retryTarget, setRetryTarget] = useState<{
    key: string
    attempt: number
  } | null>(null)

  const [result, setResult] = useState<{ url: string; ok: boolean } | null>(
    null,
  )

  const attempt = retryTarget?.key === key ? retryTarget?.attempt : 0

  const url =
    canonicalUrl &&
    (attempt ? `${canonicalUrl}?retry=${attempt}` : canonicalUrl)

  const ready = key && decoded.get(key)

  useEffect(() => {
    if (!enabled || !key || !url || !width || !height || ready) return

    let active = true

    decodePreview(key, url, width, height).then(
      () => {
        if (active) setResult({ url, ok: true })
      },
      () => {
        if (active) setResult({ url, ok: false })
      },
    )

    return () => {
      active = false
    }
  }, [enabled, key, url, width, height, ready])

  const current = result?.url === url ? result : null
  const decodedUrl = ready || (current?.ok ? current.url : undefined)

  return {
    status: !asset
      ? 'missing'
      : !enabled
        ? 'idle'
        : decodedUrl
          ? 'ready'
          : current
            ? 'error'
            : 'loading',
    url: enabled ? decodedUrl : undefined,
    retry: () => {
      if (key)
        setRetryTarget((previous) => ({
          key,
          attempt: previous?.key === key ? previous.attempt + 1 : 1,
        }))
    },
  }
}
