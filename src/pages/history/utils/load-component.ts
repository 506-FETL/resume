/** 浏览器会记住失败的模块 URL；用户重试时重新请求同源分包，并核对具名入口。 */
export function historyComponent<
  Key extends string,
  Module extends Record<Key, unknown>,
>(load: () => Promise<Module>, name: Key) {
  let failedUrl: URL | undefined
  let attempt = 0
  let pending: Promise<{ default: Module[Key] }> | undefined

  return function loadComponent() {
    if (pending) return pending

    if (failedUrl)
      failedUrl.searchParams.set('history_retry', String(++attempt))

    const request: Promise<Module> = failedUrl
      ? import(/* @vite-ignore */ failedUrl.href)
      : load()

    pending = request
      .then((module) => {
        // 生产构建可能把几个入口合在一个分包，以命名空间保留各入口的导出。
        const entry =
          module[name] ??
          Object.values(module).find(
            (candidate): candidate is Module =>
              candidate !== null &&
              typeof candidate === 'object' &&
              Reflect.get(candidate, Symbol.toStringTag) === 'Module' &&
              Object.hasOwn(candidate, name),
          )?.[name]

        if (!entry) throw new Error('版本组件尚未加载，请重试')

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
