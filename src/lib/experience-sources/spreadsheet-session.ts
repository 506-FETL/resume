import type { SpreadsheetCommand, SpreadsheetPage } from './spreadsheet-types'

export function createSpreadsheetSession() {
  const worker = new Worker(
    new URL('./spreadsheet.worker.ts', import.meta.url),
    { type: 'module' },
  )

  let nextId = 0
  let disposed = false
  let failure: Error | null = null

  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()

  worker.onmessage = (
    event: MessageEvent<{ id: number; value?: unknown; error?: string }>,
  ) => {
    const request = pending.get(event.data.id)

    pending.delete(event.data.id)

    if (event.data.error) request?.reject(new Error(event.data.error))
    else request?.resolve(event.data.value)
  }

  worker.onerror = () => {
    failure = new Error('无法加载表格预览，请重试。')

    for (const request of pending.values()) request.reject(failure)

    pending.clear()
  }

  function request<T>(command: SpreadsheetCommand): Promise<T> {
    if (disposed)
      return Promise.reject(new DOMException('已取消读取文件', 'AbortError'))
    if (failure) return Promise.reject(failure)

    return new Promise((resolve, reject) => {
      const id = nextId++

      pending.set(id, { resolve: (value) => resolve(value as T), reject })

      worker.postMessage(
        { id, ...command },
        command.action === 'open' ? [command.data] : [],
      )
    })
  }

  return {
    async open(blob: Blob, extension: string) {
      return request<string[]>({
        action: 'open',
        data: await blob.arrayBuffer(),
        extension,
      })
    },
    preview: (sheet: string, page: number) =>
      request<SpreadsheetPage>({ action: 'preview', sheet, page }),
    dispose() {
      disposed = true
      worker.terminate()

      for (const request of pending.values())
        request.reject(new DOMException('已取消读取文件', 'AbortError'))

      pending.clear()
    },
  }
}
