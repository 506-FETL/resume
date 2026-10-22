import type { TemplatePreview } from '@/lib/resume-template/source/types'
import { useEffect, useState } from 'react'
import { resumeTemplateSource } from '@/lib/resume-template/source'

// Object URL 只在卡片挂载期间存在；切换示例后旧响应不能替换当前图像。
export function useTemplatePreview(preview: TemplatePreview | undefined, enabled: boolean) {
  const [image, setImage] = useState<{ key: string, url: string } | null>(null)
  const key = preview?.asset.hash ?? ''
  useEffect(() => {
    if (!enabled || !preview)
      return
    let cancelled = false
    let objectUrl: string | undefined
    const release = resumeTemplateSource.retainResource(`asset:${preview.asset.hash}`)
    resumeTemplateSource.getAsset(preview.asset).then((blob) => {
      if (cancelled)
        return
      objectUrl = URL.createObjectURL(blob)
      setImage({ key, url: objectUrl })
    }).catch(() => {
      // 静态图缺失只影响目录展示；详情仍能独立加载真实模板。
      if (!cancelled)
        setImage(null)
    })
    return () => {
      cancelled = true
      release()
      if (objectUrl)
        URL.revokeObjectURL(objectUrl)
    }
  }, [preview, enabled, key])
  return image?.key === key && enabled ? image.url : undefined
}
