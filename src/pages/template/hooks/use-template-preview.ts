import type { TemplatePreview } from '@/lib/resume-template/source/types'
import { useEffect, useState } from 'react'
import { resumeTemplateSource } from '@/lib/resume-template/source'

interface PreviewImage { key: string, status: 'loading' | 'ready' | 'error', url?: string }

// 图片在卡片挂载期间保留，滚动不释放；切换示例后旧响应不能替换当前图像。
export function useTemplatePreview(preview: TemplatePreview | undefined, enabled: boolean) {
  const [image, setImage] = useState<PreviewImage | null>(null)
  const [attempt, setAttempt] = useState({ key: '', number: 0 })
  const key = preview?.asset.hash ?? ''
  useEffect(() => {
    if (!enabled || !preview)
      return
    let cancelled = false
    let objectUrl: string | undefined
    let release: (() => void) | undefined
    setImage({ key, status: 'loading' })
    const load = async () => {
      try {
        release = resumeTemplateSource.retainResource(`asset:${key}`)
        const blob = await resumeTemplateSource.getAsset(preview.asset, { force: attempt.key === key })
        if (cancelled)
          return
        objectUrl = URL.createObjectURL(blob)
        const decoded = new Image()
        decoded.src = objectUrl
        await decoded.decode()
        if (!cancelled)
          setImage({ key, status: 'ready', url: objectUrl })
      }
      catch {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = undefined
        }
        if (!cancelled)
          setImage({ key, status: 'error' })
      }
      finally {
        // Blob URL 已持有图片；无需永久固定 Source 缓存，避免长列表触及 64 个活动资源上限。
        release?.()
      }
    }
    load()
    return () => {
      cancelled = true
      release?.()
      if (objectUrl)
        URL.revokeObjectURL(objectUrl)
    }
  }, [preview, enabled, key, attempt])
  const current = image?.key === key ? image : null
  return {
    status: !preview ? 'missing' : current?.status ?? (enabled ? 'loading' : 'idle'),
    url: current?.status === 'ready' ? current.url : undefined,
    retry: () => setAttempt(current => ({ key, number: current.number + 1 })),
  }
}
