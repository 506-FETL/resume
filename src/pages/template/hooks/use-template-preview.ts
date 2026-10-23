import type { TemplatePreview } from '@/lib/resume-template/source/types'
import { useEffect } from 'react'
import { IDLE_IMAGE, useTemplateImageStore } from '@/store/resume-template/images'

export function useTemplatePreview(preview: TemplatePreview | undefined, enabled: boolean) {
  const asset = preview?.asset
  const image = useTemplateImageStore(state => asset ? state.images[asset.hash] ?? IDLE_IMAGE : IDLE_IMAGE)
  const load = useTemplateImageStore(state => state.load)
  const retain = useTemplateImageStore(state => state.retain)
  useEffect(() => {
    if (!asset)
      return
    const release = retain(asset.hash)
    if (enabled)
      load(asset)
    return release
  }, [asset, enabled, load, retain])
  return {
    status: !asset ? 'missing' : image.status,
    url: image.status === 'ready' ? image.url : undefined,
    retry: () => {
      if (asset)
        load(asset, true)
    },
  }
}
