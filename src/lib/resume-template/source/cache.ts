import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'

export interface CachedResource { key: string, value: unknown, expiresAt: number, savedAt: number }
export interface TemplateResourceCache {
  get: (key: string) => Promise<CachedResource | undefined>
  set: (record: CachedResource) => Promise<void>
  delete: (key: string) => Promise<void>
  retain?: (key: string) => () => void
}
interface TemplateCacheDB extends DBSchema {
  resources: { key: string, value: CachedResource, indexes: { savedAt: number } }
}
export const MAX_CACHE_RECORDS = 128
export const MAX_CACHE_BYTES = 32 * 1024 * 1024
export function resourceBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}
export function cacheEvictions(records: CachedResource[], retained: ReadonlySet<string>): string[] {
  let bytes = records.reduce((total, record) => total + resourceBytes(record.value), 0)
  let count = records.length
  const removed: string[] = []
  for (const record of [...records].sort((a, b) => a.savedAt - b.savedAt)) {
    if (count <= MAX_CACHE_RECORDS && bytes <= MAX_CACHE_BYTES)
      break
    if (retained.has(record.key))
      continue
    removed.push(record.key)
    bytes -= resourceBytes(record.value)
    count--
  }
  return removed
}
const STORAGE_WAIT_MS = 500

// 私有模式、磁盘配额或 IndexedDB blocked 不阻塞线上读取。
async function bestEffort<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation.catch(() => fallback), new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), STORAGE_WAIT_MS)
    })])
  }
  finally {
    clearTimeout(timer)
  }
}
export function createTemplateCache(namespace: string): TemplateResourceCache {
  const retained = new Map<string, number>()
  let pending: Promise<IDBPDatabase<TemplateCacheDB>> | undefined
  const database = () => {
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB unavailable'))
    pending ??= openDB<TemplateCacheDB>(`resume-public-templates-v2:${namespace}`, 1, {
      upgrade(db) {
        db.createObjectStore('resources', { keyPath: 'key' }).createIndex('savedAt', 'savedAt')
      },
      blocking() {
        pending?.then(db => db.close()).catch(() => {})
        pending = undefined
      },
      terminated() { pending = undefined },
    }).catch((error) => {
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
        if (count > 0)
          retained.set(key, count)
        else retained.delete(key)
      }
    },
    get: key => bestEffort(database().then(db => db.get('resources', key)), undefined),
    delete: key => bestEffort(database().then(db => db.delete('resources', key)), undefined),
    set: record => bestEffort(database().then(async (db) => {
      const tx = db.transaction('resources', 'readwrite')
      if (resourceBytes(record.value) > MAX_CACHE_BYTES) {
        await tx.done
        return
      }
      await tx.store.put(record)
      const records = await tx.store.getAll()
      const evictions = cacheEvictions(records, new Set(retained.keys()))
      for (const key of evictions)
        await tx.store.delete(key)
      const kept = records.filter(entry => !evictions.includes(entry.key))
      const count = kept.length
      const bytes = kept.reduce((total, entry) => total + resourceBytes(entry.value), 0)
      // 活动资源保留在内存；磁盘容量不足时不继续累积写入。
      if (count > MAX_CACHE_RECORDS || bytes > MAX_CACHE_BYTES)
        await tx.store.delete(record.key)
      await tx.done
    }), undefined),
  }
}
