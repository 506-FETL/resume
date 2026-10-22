import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'

export interface CachedResource { key: string, value: unknown, expiresAt: number, savedAt: number }
export interface TemplateResourceCache {
  get: (key: string) => Promise<CachedResource | undefined>
  set: (record: CachedResource) => Promise<void>
  delete: (key: string) => Promise<void>
}
interface TemplateCacheDB extends DBSchema {
  resources: { key: string, value: CachedResource, indexes: { savedAt: number } }
}
const MAX_CACHE_RECORDS = 128
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
  let pending: Promise<IDBPDatabase<TemplateCacheDB>> | undefined
  const database = () => {
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB unavailable'))
    pending ??= openDB<TemplateCacheDB>(`resume-public-templates-v1:${namespace}`, 1, {
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
    get: key => bestEffort(database().then(db => db.get('resources', key)), undefined),
    delete: key => bestEffort(database().then(db => db.delete('resources', key)), undefined),
    set: record => bestEffort(database().then(async (db) => {
      const tx = db.transaction('resources', 'readwrite')
      await tx.store.put(record)
      let excess = await tx.store.count() - MAX_CACHE_RECORDS
      let cursor = excess > 0 ? await tx.store.index('savedAt').openCursor() : null
      while (cursor && excess-- > 0) {
        await cursor.delete()
        cursor = await cursor.continue()
      }
      await tx.done
    }), undefined),
  }
}
