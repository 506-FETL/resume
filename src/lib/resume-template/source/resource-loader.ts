import type { CachedResource, TemplateResourceCache } from './cache'
import { TemplateResolutionError } from '../definition-schema'
import { MAX_CACHE_BYTES, resourceBytes } from './cache'

const OFFLINE_CATALOG_MAX_AGE = 24 * 60 * 60 * 1000
const MEMORY_LIMIT = 128

export function createResourceLoader({ cache, now = Date.now }: {
  cache: TemplateResourceCache
  now?: () => number
}) {
  const memory = new Map<string, CachedResource>()
  const pending = new Map<string, { id: number, promise: Promise<unknown> }>()
  const retained = new Map<string, number>()
  const writes = new Map<string, Promise<void>>()
  let sequence = 0

  function remember(record: CachedResource) {
    memory.delete(record.key)
    memory.set(record.key, record)

    let bytes = [...memory.values()].reduce((total, entry) => total + resourceBytes(entry.value), 0)
    for (const [key, entry] of memory) {
      if (memory.size <= MEMORY_LIMIT && bytes <= MAX_CACHE_BYTES)
        break
      if (retained.has(key))
        continue
      memory.delete(key)
      bytes -= resourceBytes(entry.value)
    }
    // 消费者持有正在使用的数据；拒绝缓存无法容纳的新资源。
    if (memory.size > MEMORY_LIMIT || bytes > MAX_CACHE_BYTES)
      memory.delete(record.key)
  }

  async function read<T>(key: string, fetchValue: () => Promise<unknown>, validate: (input: unknown) => T | Promise<T>, ttl = Infinity, force = false): Promise<T> {
    let request = pending.get(key)

    if (!request || force) {
      const id = ++sequence
      const job = (async () => {
        const saved = memory.get(key) ?? await cache.get(key)
        let fallback: T | undefined

        if (saved) {
          try {
            fallback = await validate(saved.value)

            if (!force && saved.expiresAt > now()) {
              if (pending.get(key)?.id === id)
                remember(saved)
              return fallback
            }
          }
          catch {
            if (pending.get(key)?.id === id) {
              memory.delete(key)
              await cache.delete(key)
            }
          }
        }

        let value: unknown

        try {
          value = await fetchValue()
        }
        catch (error) {
          // 仅网络失败可以复用有限期旧目录；非法资源／缺版本绝不回退。
          if (
            !force && fallback !== undefined
            && saved && now() - saved.savedAt < OFFLINE_CATALOG_MAX_AGE
            && error instanceof TemplateResolutionError
            && error.code === 'LOAD_FAILED'
          ) {
            return fallback
          }

          throw error
        }
        const result = await validate(value)
        const record = { key, value, savedAt: now(), expiresAt: now() + ttl }

        if (pending.get(key)?.id === id) {
          remember(record)
          const previous = writes.get(key) ?? Promise.resolve()
          const write = previous.catch(() => {}).then(async () => {
            if (pending.get(key)?.id === id)
              await cache.set(record)
          })
          writes.set(key, write)
          try {
            await write
          }
          finally {
            if (writes.get(key) === write)
              writes.delete(key)
          }
        }

        return result
      })().finally(() => {
        if (pending.get(key)?.id === id)
          pending.delete(key)
      })

      request = { id, promise: job }
      pending.set(key, request)
    }

    return structuredClone(await request.promise) as T
  }

  return {
    read,
    retainResource(key: string) {
      if (!retained.has(key) && retained.size >= 64)
        throw new TemplateResolutionError('LOAD_FAILED', '同时使用的模板资源过多，请关闭部分预览后重试')
      retained.set(key, (retained.get(key) ?? 0) + 1)
      const releaseCache = cache.retain?.(key)
      let released = false
      return () => {
        if (released)
          return
        released = true
        const count = (retained.get(key) ?? 1) - 1
        if (count > 0)
          retained.set(key, count)
        else retained.delete(key)
        releaseCache?.()
      }
    },
  }
}
