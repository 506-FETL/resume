import { createExperienceBlocks } from '../../experience-sources/extract'
import { MAX_RESUME_PDF_PAGES, MAX_RESUME_TEXT_LENGTH } from '../const'
import { createPdfTextAssembler } from '../pdf-text'
import type { ExtractedResumeFile } from '../types'
import { ResumeImportError } from '../types'
import { checkAbort, validateText } from './file-input'

export async function extractPdf(
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<Pick<ExtractedResumeFile, 'text' | 'blocks'>> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])

  checkAbort(signal)

  const port = new Worker(workerUrl, { type: 'module' })
  const worker = pdfjs.PDFWorker.create({ port })

  const task = pdfjs.getDocument({
    data,
    worker,
    useSystemFonts: true,
  })

  const abort = () => {
    task.destroy().catch(() => {})
    port.terminate()
  }

  signal?.addEventListener('abort', abort, { once: true })

  try {
    const document = await task.promise
    const permissions = await document.getPermissions()

    if (permissions !== null)
      throw new ResumeImportError(
        'encrypted',
        '暂不支持加密 PDF，请解除密码和权限保护后再导入。',
      )

    checkAbort(signal)

    if (document.numPages > MAX_RESUME_PDF_PAGES)
      throw new ResumeImportError(
        'too-many-pages',
        'PDF 超过 30 页，请只保留简历页面后再导入。',
      )

    const pages: string[] = []
    let length = 0
    let emptyPages = 0

    for (let number = 1; number <= document.numPages; number++) {
      checkAbort(signal)

      const page = await document.getPage(number)
      const stream = page.streamTextContent()
      const reader = stream.getReader()
      const chunks: string[] = []
      const assemble = createPdfTextAssembler()

      try {
        while (true) {
          const { value, done } = await reader.read()

          checkAbort(signal)

          if (done) break

          for (const item of value.items) {
            if (!('str' in item)) continue

            const piece = assemble(item)

            length += piece.length

            if (length > MAX_RESUME_TEXT_LENGTH)
              throw new ResumeImportError(
                'too-much-text',
                '文件中的文字超过 60000 字符，请删减后再导入。',
              )

            chunks.push(piece)
          }
        }
      } finally {
        await reader.cancel().catch(() => {})
        page.cleanup()
      }

      const text = chunks.join('').trim()

      if (!text) emptyPages++

      pages.push(text)
    }

    if (emptyPages)
      throw new ResumeImportError(
        'scanned',
        emptyPages === document.numPages
          ? '这份 PDF 没有可提取的文字，可能是扫描件。请先识别文字，再粘贴导入。'
          : 'PDF 中有页面未提取到文字，可能包含扫描页。请检查原文件并改用粘贴，避免遗漏内容。',
      )

    const text = validateText(pages.join('\n\n'))
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

    return { text, blocks: createExperienceBlocks(text, ranges) }
  } catch (error) {
    checkAbort(signal)

    if (error instanceof ResumeImportError) throw error
    if (error instanceof Error && error.name === 'PasswordException')
      throw new ResumeImportError(
        'encrypted',
        '暂不支持加密 PDF，请解除密码后再导入。',
      )

    throw new ResumeImportError(
      'corrupt',
      'PDF 已损坏或无法解析，请重新导出文件，或粘贴文字。',
    )
  } finally {
    signal?.removeEventListener('abort', abort)
    await task.destroy().catch(() => {})
    worker.destroy()
    port.terminate()
  }
}
