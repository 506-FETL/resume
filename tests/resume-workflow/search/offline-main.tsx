import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '@/components/ui/button'
import '@/index.css'

type OfflineApi = typeof import('@/lib/offline-resume-manager')

const cases = ['v1', 'v2', 'v3', 'v3-legacy', 'v5', 'v5-partial'] as const
const databases = new Set<string>()

async function verifyCase(mode: (typeof cases)[number]) {
  const database = `resume-workflow-search-${mode}-${crypto.randomUUID()}`
  const version = Number(mode[1])

  databases.add(database)

  const records = [
    {
      resume_id: 'local-alpha',
      display_name: `ALPHA %_,'"\\ 中文`,
      description: '普通描述',
      type: 'default',
      created_at: '2026-11-01',
      updated_at: '2026-11-03',
      data: { marker: '正文保持原样'.repeat(1000) },
    },
    {
      resume_id: 'local-beta',
      display_name: '第二份',
      description: '仅描述 Rust 中文',
      type: 'default',
      created_at: '2026-11-01',
      updated_at: '2026-11-02',
      parent_resume_id: 'local-alpha',
      derived_status: 'ready',
      data: { marker: '原始正文' },
    },
    {
      resume_id: 'local-missing-time',
      display_name: '旧导入',
      type: 'default',
      created_at: '2026-11-01',
      data: { marker: '缺更新时间仍保留' },
    },
  ]

  const seed = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, version)

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('resumes', {
        keyPath: 'resume_id',
      })

      store.createIndex('created_at', 'created_at')
      store.createIndex('updated_at', 'updated_at')

      if (version >= 2) {
        store.createIndex('parent_resume_id', 'parent_resume_id')
        store.createIndex('derived_status', 'derived_status')
      }
      if (mode === 'v3' || mode === 'v5-partial')
        store.createIndex('display_name', 'display_name')
      if (mode === 'v3') store.createIndex('description', 'description')

      request.result
        .createObjectStore('retained-history')
        .put('其他存储表原样保留', 'sentinel')

      for (const record of records) store.put(record)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  seed.close()

  const api = (await import(
    /* @vite-ignore */ `/src/lib/offline-resume-manager.ts?search-index-db=${database}`
  )) as OfflineApi

  const originalGet = IDBObjectStore.prototype.get
  const originalGetAll = IDBObjectStore.prototype.getAll
  const originalStoreCursor = IDBObjectStore.prototype.openCursor
  const originalIndexCursor = IDBIndex.prototype.openCursor
  const reads = { get: 0, getAll: 0, valueCursor: 0 }

  IDBObjectStore.prototype.get = function (...args) {
    reads.get += 1

    return originalGet.apply(this, args)
  }
  IDBObjectStore.prototype.getAll = function (...args) {
    reads.getAll += 1

    return originalGetAll.apply(this, args)
  }
  IDBObjectStore.prototype.openCursor = function (...args) {
    reads.valueCursor += 1

    return originalStoreCursor.apply(this, args)
  }
  IDBIndex.prototype.openCursor = function (...args) {
    reads.valueCursor += 1

    return originalIndexCursor.apply(this, args)
  }

  try {
    const all = await api.getOfflineResumeLibraryIndex()
    const alpha = await api.getOfflineResumeLibraryIndex('alpha')
    const description = await api.getOfflineResumeLibraryIndex('rust')
    const literal = await api.getOfflineResumeLibraryIndex(`%_,'"\\`)
    const missing = await api.getOfflineResumeLibraryIndex('不存在')

    equal(
      all.all,
      ['local-alpha', 'local-beta', 'local-missing-time'],
      '全量稳定顺序与缺时间记录',
    )

    equal(alpha.all, ['local-alpha'], '英文名称匹配')
    equal(description.variants, ['local-beta'], '描述与岗位分类')
    equal(literal.all, ['local-alpha'], '特殊字符字面匹配')
    equal(missing.all, [], '真实零匹配')

    equal(
      reads,
      { get: 0, getAll: 0, valueCursor: 0 },
      '全文索引扫描不读取记录正文',
    )

    const summaries = await api.getOfflineResumeSummariesByIds([
      'local-alpha',
      'local-beta',
    ])

    equal(reads.get, 2, '摘要按当前页读取')

    equal(
      summaries.some((item) => 'data' in item),
      false,
      '摘要不返回正文',
    )
  } finally {
    IDBObjectStore.prototype.get = originalGet
    IDBObjectStore.prototype.getAll = originalGetAll
    IDBObjectStore.prototype.openCursor = originalStoreCursor
    IDBIndex.prototype.openCursor = originalIndexCursor
  }

  const connection = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  try {
    equal(
      connection.version,
      version > 3 || mode === 'v3-legacy' ? version + 1 : 3,
      '数据库版本升级',
    )

    const tx = connection.transaction(['resumes', 'retained-history'])
    const store = tx.objectStore('resumes')
    const saved = await requestResult(store.getAll())

    const sentinel = await requestResult(
      tx.objectStore('retained-history').get('sentinel'),
    )

    equal(saved, records, '原始简历及正文完整保留')
    equal(sentinel, '其他存储表原样保留', '高版本额外存储表保留')

    equal(
      store.indexNames.contains('display_name') &&
        store.indexNames.contains('description'),
      true,
      '两项搜索索引存在',
    )
  } finally {
    connection.close()

    await deleteIsolatedDatabase(database)
  }

  return {
    mode,
    passed: true,
    searchRecordReads: 0,
    summaryRecordReads: reads.get,
    cleaned: true,
  }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function deleteIsolatedDatabase(database: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(database)

    request.onsuccess = () => {
      databases.delete(database)
      resolve()
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('隔离数据库清理被阻塞'))
  })
}

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`,
    )
}

function OfflineFixture() {
  const [report, setReport] = useState<unknown[]>([])
  const [running, setRunning] = useState(false)

  async function run() {
    setReport([])
    setRunning(true)

    try {
      for (const mode of cases) {
        const result = await verifyCase(mode)

        setReport((previous) => [...previous, result])
      }
    } catch (error) {
      setReport((previous) => [...previous, { failed: String(error) }])
    } finally {
      for (const database of databases) {
        try {
          await deleteIsolatedDatabase(database)
        } catch (error) {
          setReport((previous) => [
            ...previous,
            { cleanupFailed: String(error), database },
          ])
        }
      }

      setRunning(false)
    }
  }

  useEffect(() => {
    run()
  }, [])

  return (
    <main className='h-full overflow-auto p-6'>
      <h1 className='mb-4 text-xl font-semibold'>本地搜索索引隔离验收</h1>
      <Button disabled={running} onClick={run}>
        {running ? '验收中' : '重新验证'}
      </Button>
      <pre data-offline-report className='mt-4 whitespace-pre-wrap'>
        {JSON.stringify({ running, report }, null, 2)}
      </pre>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<OfflineFixture />)
