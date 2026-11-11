import catalogRows from './catalog.json'
import templateResource from './template-resource.json'

const memory = new Map<string, string>()

const storage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  getItem: (key) => memory.get(key) ?? null,
  removeItem: (key) => memory.delete(key),
  setItem: (key, value) => memory.set(key, value),
}

Object.defineProperty(window, 'localStorage', { value: storage })
Object.defineProperty(window, 'sessionStorage', { value: storage })

const nativeOpen = indexedDB.open.bind(indexedDB)
const databasePrefix = 'resume-workflow-creation:'
const connections = new Set<IDBDatabase>()

indexedDB.open = (name, version) => {
  const request = nativeOpen(`${databasePrefix}${name}`, version)

  request.addEventListener('success', () => connections.add(request.result))

  return request
}

const nativeMatchMedia = window.matchMedia.bind(window)
const reducedQuery = nativeMatchMedia('(prefers-reduced-motion: reduce)')
let reducedMotion = reducedQuery.matches

Object.defineProperty(reducedQuery, 'matches', { get: () => reducedMotion })

window.matchMedia = (query) =>
  query === '(prefers-reduced-motion: reduce)' ||
  query === '(prefers-reduced-motion)'
    ? reducedQuery
    : nativeMatchMedia(query)

function setReducedMotion(value: boolean) {
  reducedMotion = value

  reducedQuery.dispatchEvent(
    new MediaQueryListEvent('change', {
      matches: value,
      media: reducedQuery.media,
    }),
  )
}

async function cleanupDatabases() {
  for (const connection of connections) connection.close()

  connections.clear()

  const databases = await indexedDB.databases()

  const names = databases
    .map((database) => database.name)
    .filter((name): name is string => Boolean(name?.startsWith(databasePrefix)))

  await Promise.all(
    names.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name)

          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
          request.onblocked = () =>
            reject(new Error('请关闭其他创建验收标签页后重试'))
        }),
    ),
  )

  return names.length
}

const originalFetch = window.fetch.bind(window)

window.fetch = async (input, init) => {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.href,
  )

  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET')

  if (url.origin === window.location.origin) return originalFetch(input, init)
  if (method.toUpperCase() !== 'GET')
    throw new Error(`隔离样本禁止远端写入：${method} ${url.pathname}`)
  if (url.pathname === '/rest/v1/official_resume_template_catalog') {
    const templateId = url.searchParams.get('template_id')?.replace(/^eq\./, '')

    const rows = templateId
      ? catalogRows.filter((row) => row.metadata.templateId === templateId)
      : catalogRows

    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 13)

    return Response.json(rows.slice(offset, offset + limit))
  }
  if (
    url.pathname === '/rest/v1/official_resume_template_versions' &&
    url.searchParams.get('template_id') === 'eq.default' &&
    url.searchParams.get('version') === 'eq.3'
  )
    return Response.json([templateResource])
  if (
    [
      '/rest/v1/official_resume_template_versions',
      '/rest/v1/official_resume_example_versions',
      '/rest/v1/official_resume_assets',
    ].includes(url.pathname)
  )
    return originalFetch(input, init)

  throw new Error(`隔离样本未提供该远端读取：${url.pathname}`)
}

const { mountFixture } = await import(
  /* @vite-ignore */ new URL('./render.tsx?revision=5', import.meta.url).href
)

mountFixture({
  getReducedMotion: () => reducedMotion,
  setReducedMotion,
  cleanupDatabases,
})
