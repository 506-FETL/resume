import type {
  DerivedStatus,
  PersistedResumeSnapshot,
  ResumeType,
  VariantMetadata,
} from '@/lib/schema'
import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'

export interface ResumeDB extends DBSchema {
  resumes: {
    key: string // resume_id
    value: {
      resume_id: string
      display_name: string
      description?: string
      type: ResumeType
      created_at: string
      updated_at: string
      data: Partial<PersistedResumeSnapshot>
      parent_resume_id?: string | null
      linked_jd_text?: string | null
      derived_metadata?: VariantMetadata | null
      derived_status?: DerivedStatus | null
    }
    indexes: {
      created_at: string
      updated_at: string
      parent_resume_id: string
      derived_status: string
      display_name: string
      description: string
    }
  }
}

export type OfflineResumeRecord = ResumeDB['resumes']['value']

export const DB_NAME = 'offline-resumes'

export const DB_VERSION = 3

export let dbInstance: IDBPDatabase<ResumeDB> | null = null

/**
 * 获取或创建数据库实例
 */
let opening: Promise<IDBPDatabase<ResumeDB>> | null = null

export function getDB(): Promise<IDBPDatabase<ResumeDB>> {
  if (dbInstance) return Promise.resolve(dbInstance)
  if (opening) return opening

  opening = openResumeDatabase().finally(() => {
    opening = null
  })

  return opening
}

async function openResumeDatabase(): Promise<IDBPDatabase<ResumeDB>> {
  let connection = await openDB<ResumeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const resumeStore = db.createObjectStore('resumes', {
          keyPath: 'resume_id',
        })

        resumeStore.createIndex('created_at', 'created_at')
        resumeStore.createIndex('updated_at', 'updated_at')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('resumes')

        store.createIndex('parent_resume_id', 'parent_resume_id')
        store.createIndex('derived_status', 'derived_status')
      }
      if (oldVersion < 3) {
        const store = tx.objectStore('resumes')

        store.createIndex('display_name', 'display_name')
        store.createIndex('description', 'description')
      }
    },
  }).catch(async (error: unknown) => {
    if (!(error instanceof DOMException) || error.name !== 'VersionError')
      throw error

    // 旧版本曾在同一数据库中新增其他存储表；保留已有版本和全部数据。
    const existing = await openDB<ResumeDB>(DB_NAME)

    try {
      const transaction = existing.transaction('resumes', 'readonly')
      const store = transaction.store

      const indexes = [
        'created_at',
        'updated_at',
        'parent_resume_id',
        'derived_status',
      ] as const

      if (
        store.keyPath !== 'resume_id' ||
        indexes.some(
          (name) =>
            !store.indexNames.contains(name) ||
            store.index(name).keyPath !== name ||
            store.index(name).unique,
        )
      )
        throw new Error('本地简历数据库结构不兼容，已有数据已保留')

      await transaction.done

      return existing
    } catch (error) {
      existing.close()

      throw error
    }
  })

  try {
    const transaction = connection.transaction('resumes', 'readonly')
    const store = transaction.store
    const searchIndexes = ['display_name', 'description'] as const

    if (
      searchIndexes.some(
        (name) =>
          store.indexNames.contains(name) &&
          (store.index(name).keyPath !== name || store.index(name).unique),
      )
    )
      throw new Error('本地简历搜索索引不兼容，已有数据已保留')

    const missing = searchIndexes.filter(
      (name) => !store.indexNames.contains(name),
    )

    await transaction.done

    // 历史数据库也可能恰好使用当前版本号，按实际索引补齐，不覆盖其他存储表。
    if (missing.length) {
      const version = connection.version + 1

      connection.close()

      connection = await openDB<ResumeDB>(DB_NAME, version, {
        upgrade(_db, _oldVersion, _newVersion, tx) {
          const resumeStore = tx.objectStore('resumes')

          for (const name of missing) resumeStore.createIndex(name, name)
        },
      })
    }
  } catch (error) {
    connection.close()

    throw error
  }

  dbInstance = connection

  // 当其他标签页升级数据库版本时，关闭当前连接以避免阻塞
  connection.onversionchange = () => {
    connection.close()

    if (dbInstance === connection) dbInstance = null
  }

  // 异常关闭时清除缓存引用，下次访问会重新打开
  connection.onclose = () => {
    if (dbInstance === connection) dbInstance = null
  }

  return connection
}
