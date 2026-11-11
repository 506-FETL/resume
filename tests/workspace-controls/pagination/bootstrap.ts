class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
})

Object.defineProperty(window, 'sessionStorage', {
  value: new MemoryStorage(),
})

const params = new URLSearchParams(window.location.search)
const originalFetch = window.fetch.bind(window)

localStorage.setItem(
  'sidebarOpen',
  params.get('sidebar') === '0' ? 'false' : 'true',
)

window.fetch = async (input, init) => {
  const address = input instanceof Request ? input.url : String(input)
  const url = new URL(address, window.location.origin)

  if (url.origin !== window.location.origin) {
    document.documentElement.dataset.blockedRemote = String(
      Number(document.documentElement.dataset.blockedRemote ?? 0) + 1,
    )

    throw new Error(`隔离验收禁止外部请求：${url.hostname}`)
  }

  return originalFetch(input, init)
}

window.WebSocket = new Proxy(window.WebSocket, {
  construct(Target, args, newTarget) {
    const url = new URL(String(args[0]), window.location.origin)

    if (url.hostname !== window.location.hostname)
      throw new Error('隔离验收禁止外部 WebSocket')

    return Reflect.construct(Target, args, newTarget)
  },
})

if (params.get('offline-index') === '1') {
  const openDatabase = window.indexedDB.open.bind(window.indexedDB)

  window.indexedDB.open = (name, version) => {
    if (!name.startsWith('resume-workflow-search-'))
      throw new Error('隔离验收只允许本次合成索引数据库')

    return version === undefined
      ? openDatabase(name)
      : openDatabase(name, version)
  }

  await import('../../resume-workflow/search/offline-main')
} else {
  window.indexedDB.open = () => {
    throw new Error('隔离验收不读取或写入 IndexedDB')
  }

  await import('./main')
}
