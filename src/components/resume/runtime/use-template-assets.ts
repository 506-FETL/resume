import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import { useCallback, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { IDLE_IMAGE, useTemplateImageStore } from '@/store/resume-template/images'

const EMPTY_ASSETS: ReadonlyMap<string, string> = new Map()
const URL_RELEASE_DELAY_MS = 60000

export function useTemplateAssets(definition: TemplateDefinition | null | undefined) {
  const images = useTemplateImageStore(useShallow(state => definition?.assets.map(asset => state.images[asset.sha256] ?? IDLE_IMAGE) ?? []))
  const load = useTemplateImageStore(state => state.load)
  const retain = useTemplateImageStore(state => state.retain)
  const loadAssets = useCallback((force = false) => {
    definition?.assets.forEach(asset => load({ hash: asset.sha256, byteLength: asset.bytes, mimeType: asset.mimeType, width: asset.width, height: asset.height }, force))
  }, [definition, load])
  useEffect(() => {
    const releases = definition?.assets.map(asset => retain(asset.sha256, URL_RELEASE_DELAY_MS)) ?? []
    loadAssets()
    return () => releases.forEach(release => release())
  }, [definition, loadAssets, retain])
  const assetUrls = useMemo(() => {
    if (!definition?.assets.length)
      return EMPTY_ASSETS
    const urls = new Map<string, string>()
    definition.assets.forEach((asset, index) => {
      const image = images[index]
      if (image?.status === 'ready')
        urls.set(asset.id, image.url)
    })
    return urls
  }, [definition, images])
  const failure = images.find((image, index) => image.status === 'error' && definition?.assets[index]?.required)
  const loading = images.some(image => image.status === 'idle' || image.status === 'loading')
  return {
    status: failure ? 'error' as const : loading ? 'loading' as const : 'ready' as const,
    assetUrls,
    error: failure?.status === 'error' ? failure.error : null,
    retry: useCallback(() => loadAssets(true), [loadAssets]),
  }
}
