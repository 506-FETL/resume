import { checkAbort, createFileContent } from './shared'

export async function readSpreadsheet(
  data: ArrayBuffer,
  extension: string,
  signal?: AbortSignal,
) {
  checkAbort(signal)

  const worker = new Worker(
    new URL('./spreadsheet.worker.ts', import.meta.url),
    {
      type: 'module',
    },
  )

  try {
    const text = await new Promise<string>((resolve, reject) => {
      const abort = () => {
        worker.terminate()
        reject(new DOMException('已取消读取文件', 'AbortError'))
      }

      const cleanup = () => signal?.removeEventListener('abort', abort)

      worker.onmessage = (
        event: MessageEvent<{ text?: string; error?: string }>,
      ) => {
        cleanup()

        if (event.data.error) reject(new Error(event.data.error))
        else resolve(event.data.text ?? '')
      }

      worker.onerror = () => {
        cleanup()
        reject(new Error('无法加载表格读取器，请重试。'))
      }

      signal?.addEventListener('abort', abort, { once: true })
      worker.postMessage({ data, extension }, [data])
    })

    checkAbort(signal)

    return createFileContent(text)
  } finally {
    worker.terminate()
  }
}
