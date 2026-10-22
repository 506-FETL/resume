import type { TemplateDefinition } from '@/lib/resume-template/definition-schema'
import { useCallback, useEffect, useRef, useState } from 'react'
import { asTemplateError, TemplateResolutionError } from '@/lib/resume-template/definition-schema'
import { resumeTemplateSource } from '@/lib/resume-template/source'

interface AssetState {
  definition: TemplateDefinition | null | undefined
  attempt: number
  status: 'loading' | 'ready' | 'error'
  assetUrls: ReadonlyMap<string, string>
  error: TemplateResolutionError | null
}
const EMPTY_ASSETS: ReadonlyMap<string, string> = new Map()
const URL_RELEASE_DELAY_MS = 60000
/** 哈希验证由 source 完成；此处等待浏览器解码，并将资源生命周期绑定到活动预览。 */
export function useTemplateAssets(definition: TemplateDefinition | null | undefined) {
  const [retryRequest, setRetryRequest] = useState<{ definition: TemplateDefinition | null | undefined, sequence: number }>({ definition: null, sequence: 0 })
  const consumedRetry = useRef(0)
  const attempt = retryRequest.definition === definition ? retryRequest.sequence : 0
  const [state, setState] = useState<AssetState>({ definition: undefined, attempt: 0, status: 'ready', assetUrls: EMPTY_ASSETS, error: null })
  const retry = useCallback(() => setRetryRequest(value => ({ definition, sequence: value.sequence + 1 })), [definition])
  useEffect(() => {
    if (!definition?.assets.length)
      return
    const force = attempt > 0 && consumedRetry.current !== attempt
    if (force)
      consumedRetry.current = attempt
    let disposed = false
    const urls = new Map<string, string>()
    const releases = definition.assets.map(asset => resumeTemplateSource.retainResource(`asset:${asset.sha256}`))
    const tasks = definition.assets.map(async (asset) => {
      let url: string | undefined
      try {
        const blob = await resumeTemplateSource.getAsset({ hash: asset.sha256, byteLength: asset.bytes, mimeType: asset.mimeType, width: asset.width, height: asset.height }, force ? { force: true } : undefined)
        if (disposed)
          return
        url = URL.createObjectURL(blob)
        const image = new Image()
        image.src = url
        await image.decode()
        if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height)
          throw new TemplateResolutionError('INVALID_DEFINITION', '模板素材尺寸与清单不符')
        if (disposed) {
          URL.revokeObjectURL(url)
          return
        }
        urls.set(asset.id, url)
      }
      catch (error) {
        if (url)
          URL.revokeObjectURL(url)
        if (asset.required)
          throw error
      }
    })
    // 等全部任务落定后释放失败资源，避免其他请求迟到时遗失 blob URL。
    Promise.allSettled(tasks).then((results) => {
      if (disposed)
        return
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') {
        urls.forEach(url => URL.revokeObjectURL(url))
        urls.clear()
        setState({ definition, attempt, status: 'error', assetUrls: EMPTY_ASSETS, error: asTemplateError(failure.reason) })
      }
      else {
        setState({ definition, attempt, status: 'ready', assetUrls: new Map(urls), error: null })
      }
    })
    return () => {
      disposed = true
      const retainedUrls = [...urls.values()]
      // 打印 iframe 在卸载预览后仍可能正读取同一 URL。
      // 此计时器故意跨越组件卸载存活，保护正在读取素材的打印副本。
      // eslint-disable-next-line react-web-api/no-leaked-timeout
      setTimeout(() => {
        retainedUrls.forEach(url => URL.revokeObjectURL(url))
        releases.forEach(release => release())
      }, URL_RELEASE_DELAY_MS)
    }
  }, [definition, attempt])
  if (!definition?.assets.length)
    return { status: 'ready' as const, assetUrls: EMPTY_ASSETS, error: null, retry }
  if (state.definition !== definition || state.attempt !== attempt)
    return { status: 'loading' as const, assetUrls: EMPTY_ASSETS, error: null, retry }
  return { status: state.status, assetUrls: state.assetUrls, error: state.error, retry }
}
