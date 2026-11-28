/** 浏览器会记住失败的模块 URL；用户重试时重新请求同源分包，并核对具名入口。 */
export function loadComponent<
  Key extends string,
  Module extends Record<Key, unknown>,
>(load: () => Promise<Module>, name: Key) {
  let failedUrl: URL | undefined
  let attempt = 0
  let pending: Promise<{ default: Module[Key] }> | undefined

  return function loadEntry() {
    if (pending) return pending

    if (failedUrl)
      failedUrl.searchParams.set('component_retry', String(++attempt))

    const request: Promise<Module> = failedUrl
      ? import(/* @vite-ignore */ failedUrl.href)
      : load()

    pending = request
      .then((module) => {
        // 生产构建可能把几个入口合在一个分包，以命名空间保留各入口的导出。
        const candidates = Object.values(module).filter(
          (candidate): candidate is Module =>
            candidate !== null &&
            typeof candidate === 'object' &&
            Reflect.get(candidate, Symbol.toStringTag) === 'Module' &&
            Object.hasOwn(candidate, name),
        )

        const entry =
          module[name] ??
          (candidates.length === 1 ? candidates[0][name] : undefined)

        if (!entry) throw new Error('暂时无法打开，请重试')

        return { default: entry }
      })
      .catch((error: unknown) => {
        pending = undefined

        const address =
          error instanceof Error &&
          error.message.match(/https?:\/\/[^\s'"<>]+/)?.[0]

        if (address) {
          const url = new URL(address)

          if (
            url.origin === location.origin &&
            /\.(?:js|tsx?)$/.test(url.pathname)
          )
            failedUrl = url
        }

        throw error
      })

    return pending
  }
}
