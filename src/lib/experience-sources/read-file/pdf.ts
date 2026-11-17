import { createPdfTextAssembler } from '../../resume-import/pdf-text'
import { checkAbort, createFileContent } from './shared'

export async function readPdf(data: ArrayBuffer, signal?: AbortSignal) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])

  checkAbort(signal)

  const port = new Worker(workerUrl, { type: 'module' })
  const worker = pdfjs.PDFWorker.create({ port })
  const task = pdfjs.getDocument({ data, worker, useSystemFonts: true })
  let interrupted = false
  let rejectInterruption: (error: Error) => void

  const interruption = new Promise<never>((_, reject) => {
    rejectInterruption = reject
  })

  const interrupt = (error: Error) => {
    interrupted = true
    rejectInterruption(error)
    task.destroy().catch(() => {})
    worker.destroy()
    port.terminate()
  }

  const abort = () =>
    interrupt(new DOMException('已取消读取文件', 'AbortError'))

  const workerError = () =>
    interrupt(new Error('无法加载 PDF 读取器，请重试。'))

  const wait = <T>(operation: Promise<T>) =>
    Promise.race([operation, interruption])

  signal?.addEventListener('abort', abort, { once: true })
  port.addEventListener('error', workerError, { once: true })

  try {
    const document = await wait(task.promise)
    const permissions = await wait(document.getPermissions())

    if (permissions !== null)
      throw new Error(
        'PDF 受密码或权限保护，暂时无法读取文字。请解除保护后再读取。',
      )

    const pages: string[] = []
    const emptyPages: number[] = []

    for (let number = 1; number <= document.numPages; number++) {
      checkAbort(signal)

      const page = await wait(document.getPage(number))
      const reader = page.streamTextContent().getReader()
      const chunks: string[] = []
      const assemble = createPdfTextAssembler()

      try {
        while (true) {
          const { value, done } = await wait(reader.read())

          checkAbort(signal)

          if (done) break

          for (const item of value.items) {
            if ('str' in item) chunks.push(assemble(item))
          }
        }
      } finally {
        const cancellation = reader.cancel().catch(() => {})

        if (!interrupted) await cancellation

        page.cleanup()
      }

      const text = chunks.join('').trim()

      if (!text) emptyPages.push(number)

      pages.push(text)
    }

    const text = pages.join('\n\n')
    let offset = 0

    const ranges = pages.flatMap((page, index) => {
      const result = Array.from(page.matchAll(/[^\n]+/g), (match) => ({
        start: offset + match.index,
        end: offset + match.index + match[0].length,
        page: index + 1,
      }))

      offset += page.length + 2

      return result
    })

    checkAbort(signal)

    const warning = emptyPages.length
      ? `第 ${emptyPages.join('、')} 页未读到文字，可能是空白页或扫描页；这些页面的内容尚未读取。`
      : undefined

    return createFileContent(text, ranges, warning)
  } catch (error) {
    checkAbort(signal)

    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error('PDF 受密码保护，暂时无法读取文字。请解除密码后再读取。')
    if (error instanceof Error && error.message.startsWith('PDF 受'))
      throw error
    if (error instanceof Error && error.message.startsWith('无法加载 PDF'))
      throw error

    throw new Error('PDF 已损坏或无法解析，未能读取文字。可以下载原件检查。')
  } finally {
    signal?.removeEventListener('abort', abort)
    port.removeEventListener('error', workerError)

    const destruction = task.destroy().catch(() => {})

    // 已终止的 port 不会再响应 PDF.js 的清理握手，不能继续等待它。
    if (!interrupted) await destruction

    worker.destroy()
    port.terminate()
  }
}
