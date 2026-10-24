import { TemplateResolutionError } from '../definition-schema'

export type TemplateTransport = (
  path: string,
  params?: Record<string, string>,
) => Promise<unknown>

export function createTemplateTransport(
  baseUrl: string,
  publishableKey: string,
  fetcher: typeof fetch = fetch,
): TemplateTransport {
  let active = 0
  const queue: Array<() => void> = []

  return async (path, params = {}) => {
    // 仅公开资源，无认证锁、用户 token 或 Edge Function 冷启动。
    if (active >= 4) await new Promise<void>((resolve) => queue.push(resolve))
    else active++

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const url = new URL(`/rest/v1/${path}`, baseUrl)

      url.search = new URLSearchParams(params).toString()

      const response = await fetcher(url, {
        headers: { apikey: publishableKey, Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit',
      })

      if (!response.ok)
        throw new TemplateResolutionError(
          'LOAD_FAILED',
          '线上模板资源暂时不可用，请重试',
        )

      return await response.json()
    } catch (error) {
      if (error instanceof TemplateResolutionError) throw error

      throw new TemplateResolutionError(
        'LOAD_FAILED',
        '无法连接模板服务，请检查网络后重试',
      )
    } finally {
      clearTimeout(timeout)

      const next = queue.shift()

      if (next) next()
      else active--
    }
  }
}
