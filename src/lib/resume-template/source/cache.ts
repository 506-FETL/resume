import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB, unwrap } from 'idb'

export interface CachedResource {
  key: string
  value: unknown
  expiresAt: number
  savedAt: number
}

export interface TemplateResourceCache {
  get: (key: string) => Promise<CachedResource | undefined>
  set: (record: CachedResource) => Promise<void>
  delete: (key: string) => Promise<void>
  retain?: (key: string) => () => void
}

interface CacheUsage {
  key: string
  savedAt: number
  bytes: number
}

interface TemplateCacheDB extends DBSchema {
  usage: { key: string; value: CacheUsage }
  resources: {
    key: string
    value: CachedResource
    indexes: { savedAt: number }
  }
}

export const MAX_CACHE_RECORDS = 128

export const MAX_CACHE_BYTES = 32 * 1024 * 1024

export function resourceBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

function cacheEvictions(
  records: CacheUsage[],
  retained: ReadonlyMap<string, number>,
  incoming: string,
) {
  let bytes = records.reduce((total, record) => total + record.bytes, 0)
  let count = records.length
  const removed: string[] = []

  for (const record of records.sort((a, b) => a.savedAt - b.savedAt)) {
    if (count <= MAX_CACHE_RECORDS && bytes <= MAX_CACHE_BYTES) break
    if (retained.has(record.key)) continue

    removed.push(record.key)
    bytes -= record.bytes
    count--
  }

  // 全部候选项都在使用时，内存仍持有新资源，磁盘拒绝超额写入。
  if (count > MAX_CACHE_RECORDS || bytes > MAX_CACHE_BYTES)
    removed.push(incoming)

  return removed
}

const STORAGE_WAIT_MS = 500

// 私有模式、磁盘配额或 IndexedDB blocked 不阻塞线上读取。
async function bestEffort<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), STORAGE_WAIT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function createTemplateCache(namespace: string): TemplateResourceCache {
  const retained = new Map<string, number>()
  let pending: Promise<IDBPDatabase<TemplateCacheDB>> | undefined

  const database = () => {
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB unavailable'))

    pending ??= openDB<TemplateCacheDB>(
      `resume-public-templates-v3:${namespace}`,
      2,
      {
        upgrade(db, oldVersion, _newVersion, transaction) {
          const usage = unwrap(
            db.createObjectStore('usage', { keyPath: 'key' }),
          )

          if (oldVersion === 0) {
            db.createObjectStore('resources', { keyPath: 'key' }).createIndex(
              'savedAt',
              'savedAt',
            )

            return
          }

          // 原缓存仍可离线使用。只在升级事务中逐条补齐大小。
          const request = unwrap(
            transaction.objectStore('resources'),
          ).openCursor()

          request.onsuccess = () => {
            const cursor = request.result

            if (!cursor) return

            const { key, savedAt, value } = cursor.value

            usage.put({ key, savedAt, bytes: resourceBytes(value) })
            cursor.continue()
          }
        },
        blocking() {
          pending?.then((db) => db.close()).catch(() => {})
          pending = undefined
        },
        terminated() {
          pending = undefined
        },
      },
    ).catch((error) => {
      pending = undefined

      throw error
    })

    return pending
  }

  return {
    retain(key) {
      retained.set(key, (retained.get(key) ?? 0) + 1)

      return () => {
        const count = (retained.get(key) ?? 1) - 1

        if (count > 0) retained.set(key, count)
        else retained.delete(key)
      }
    },
    get: (key) =>
      bestEffort(
        database().then((db) => db.get('resources', key)),
        undefined,
      ),
    delete: (key) =>
      bestEffort(
        database().then(async (db) => {
          const tx = db.transaction(['resources', 'usage'], 'readwrite')

          await Promise.all([
            tx.objectStore('resources').delete(key),
            tx.objectStore('usage').delete(key),
            tx.done,
          ])
        }),
        undefined,
      ),
    set: (record) =>
      bestEffort(
        database().then(async (db) => {
          const bytes = resourceBytes(record.value)

          if (bytes > MAX_CACHE_BYTES) return

          const tx = db.transaction(['resources', 'usage'], 'readwrite')
          const usage = tx.objectStore('usage')
          const resources = tx.objectStore('resources')

          await usage.put({ key: record.key, savedAt: record.savedAt, bytes })

          const evictions = cacheEvictions(
            await usage.getAll(),
            retained,
            record.key,
          )

          const writes = evictions.flatMap((key) => [
            resources.delete(key),
            usage.delete(key),
          ])

          if (!evictions.includes(record.key))
            writes.push(resources.put(record).then(() => undefined))

          await Promise.all([...writes, tx.done])
        }),
        undefined,
      ),
  }
}
