import type { ExtractedResumeFile } from './types'
import { createPdfTextAssembler } from './pdf-text'
import {
  MAX_DOCX_EXPANDED_BYTES,
  MAX_DOCX_XML_BYTES,
  MAX_RESUME_FILE_BYTES,
  MAX_RESUME_PDF_PAGES,
  MAX_RESUME_TEXT_LENGTH,
} from './const'
import { ResumeImportError } from './types'

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')
}

function validateText(text: string): string {
  if (text.length > MAX_RESUME_TEXT_LENGTH) {
    throw new ResumeImportError(
      'too-much-text',
      '文件中的文字超过 60000 字符，请删减后再导入。',
    )
  }
  if (!text.trim())
    throw new ResumeImportError('empty', '文件中没有可读取的文字，请改用粘贴。')

  return text.trim()
}

function readFile(file: File, signal?: AbortSignal): Promise<ArrayBuffer> {
  checkAbort(signal)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    const cleanup = () => signal?.removeEventListener('abort', abort)

    reader.onload = () => {
      cleanup()
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = () => {
      cleanup()

      reject(
        new ResumeImportError(
          'corrupt',
          '无法读取文件，请重新选择或粘贴文字。',
        ),
      )
    }
    reader.onabort = () => {
      cleanup()
      reject(new DOMException('已取消读取文件', 'AbortError'))
    }

    signal?.addEventListener('abort', abort, { once: true })
    reader.readAsArrayBuffer(file)
  })
}

async function extractPdf(
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
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

    return validateText(pages.join('\n\n'))
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

/** 先检查 ZIP 目录，不解压图片；正文再以 1 KB 输入分块解压并检查真实输出。 */
async function extractDocx(
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  const { Unzip, UnzipInflate } = await import('fflate')

  checkAbort(signal)

  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  let end = bytes.length - 22

  while (
    end >= Math.max(0, bytes.length - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  )
    end--

  if (end < 0 || end < bytes.length - 65557)
    throw new ResumeImportError(
      'corrupt',
      'DOCX 文件已损坏，请重新保存后再导入。',
    )

  const entries = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  let expanded = 0
  let found = false

  if (entries > 2048 || cursor >= end)
    throw new ResumeImportError(
      'corrupt',
      'DOCX 文件结构异常，请重新保存后再导入。',
    )

  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new ResumeImportError('corrupt', 'DOCX 文件目录已损坏。')

    const flags = view.getUint16(cursor + 8, true)
    const size = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)

    const next =
      cursor +
      46 +
      nameLength +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true)

    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    )

    if (flags & 1)
      throw new ResumeImportError(
        'encrypted',
        '暂不支持加密 DOCX，请解除密码后再导入。',
      )
    if (next > end)
      throw new ResumeImportError('corrupt', 'DOCX 文件目录已损坏。')

    expanded += size

    if (
      expanded > MAX_DOCX_EXPANDED_BYTES ||
      (/^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name) &&
        size > MAX_DOCX_XML_BYTES)
    )
      throw new ResumeImportError(
        'too-large',
        'DOCX 解压后的内容过大，请删减图片或内容后再导入。',
      )
    if (name === 'word/document.xml') found = true

    cursor = next
  }

  if (!found)
    throw new ResumeImportError(
      'corrupt',
      '文件不是有效的 DOCX，请使用 Word 重新保存。',
    )

  const parts = new Map<string, { chunks: Uint8Array[]; complete: boolean }>()
  let actualBytes = 0
  let failure: Error | null = null

  const unzip = new Unzip((entry) => {
    if (!/^word\/(?:document|header\d+|footer\d+)\.xml$/.test(entry.name))
      return

    if (parts.has(entry.name)) {
      failure = new ResumeImportError(
        'corrupt',
        'DOCX 包含重复正文，无法安全读取。',
      )

      return
    }

    const part = { chunks: [] as Uint8Array[], complete: false }

    parts.set(entry.name, part)

    entry.ondata = (error, chunk, final) => {
      if (error) {
        failure = error

        return
      }

      actualBytes += chunk.length

      if (actualBytes > MAX_DOCX_XML_BYTES) {
        failure = new ResumeImportError(
          'too-large',
          'DOCX 正文解压后过大，请删减内容后再导入。',
        )

        entry.terminate()

        return
      }

      part.chunks.push(chunk)

      if (final) part.complete = true
    }

    entry.start()
  })

  unzip.register(UnzipInflate)

  for (let offset = 0; offset < bytes.length; offset += 1024) {
    checkAbort(signal)

    unzip.push(
      bytes.subarray(offset, offset + 1024),
      offset + 1024 >= bytes.length,
    )

    if (failure) throw failure
    if (offset % (64 * 1024) === 0)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  checkAbort(signal)

  if (
    !parts.get('word/document.xml')?.complete ||
    Array.from(parts.values()).some((part) => !part.complete)
  )
    throw new ResumeImportError(
      'corrupt',
      'DOCX 正文不完整，请重新保存后再导入。',
    )

  const output = Array.from(parts.entries())
    .sort(([left], [right]) => {
      const rank = (name: string) =>
        name.includes('header') ? 0 : name.includes('footer') ? 2 : 1

      return rank(left) - rank(right) || left.localeCompare(right)
    })
    .map(([, part]) => docxXmlToText(part.chunks))

  return validateText(output.join('\n'))
}

function docxXmlToText(chunks: Uint8Array[]): string {
  const xmlBytes = new Uint8Array(
    chunks.reduce((size, chunk) => size + chunk.length, 0),
  )

  let position = 0

  for (const chunk of chunks) {
    xmlBytes.set(chunk, position)
    position += chunk.length
  }

  const xml = new TextDecoder('utf-8', { fatal: true }).decode(xmlBytes)

  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new ResumeImportError(
      'corrupt',
      'DOCX 包含不支持的 XML 声明，请重新保存后再导入。',
    )

  const document = new DOMParser().parseFromString(xml, 'application/xml')

  if (document.querySelector('parsererror'))
    throw new ResumeImportError(
      'corrupt',
      'DOCX 正文格式错误，请重新保存后再导入。',
    )

  const paragraphs = Array.from(document.getElementsByTagNameNS('*', 'p')).map(
    (paragraph) => {
      const text: string[] = []

      const walker = document.createTreeWalker(
        paragraph,
        NodeFilter.SHOW_ELEMENT,
      )

      while (walker.nextNode()) {
        const element = walker.currentNode as Element
        let owner = element.parentElement

        while (owner && owner.localName !== 'p') owner = owner.parentElement

        if (owner !== paragraph) continue

        if (element.localName === 't') text.push(element.textContent ?? '')
        else if (element.localName === 'tab') text.push('\t')
        else if (element.localName === 'br' || element.localName === 'cr')
          text.push('\n')
      }

      return text.join('')
    },
  )

  return paragraphs.join('\n')
}

export async function extractResumeFile(
  file: File,
  signal?: AbortSignal,
): Promise<ExtractedResumeFile> {
  checkAbort(signal)

  if (file.size > MAX_RESUME_FILE_BYTES)
    throw new ResumeImportError(
      'too-large',
      '文件超过 10 MB，请压缩或删减内容后再导入。',
    )

  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension !== 'pdf' && extension !== 'docx')
    throw new ResumeImportError(
      'unsupported',
      extension === 'doc'
        ? '暂不支持 DOC，请另存为 DOCX，或粘贴简历文字。'
        : '仅支持 PDF 和 DOCX，请重新选择文件，或粘贴简历文字。',
    )
  if (!file.size)
    throw new ResumeImportError('empty', '文件为空，请重新选择文件。')

  const data = await readFile(file, signal)

  const signature = new Uint8Array(data, 0, Math.min(data.byteLength, 8))

  if (
    extension === 'docx' &&
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
      (byte, index) => signature[index] === byte,
    )
  ) {
    throw new ResumeImportError(
      'encrypted',
      '这份 DOCX 使用了加密或旧版格式，请在 Word 中解除密码并另存为 DOCX。',
    )
  }

  try {
    const text =
      extension === 'pdf'
        ? await extractPdf(data, signal)
        : await extractDocx(data, signal)

    checkAbort(signal)

    return { text, sourceName: file.name }
  } catch (error) {
    checkAbort(signal)

    if (error instanceof ResumeImportError) throw error

    throw new ResumeImportError(
      'corrupt',
      '文件已损坏或无法解析，请重新保存文件，或粘贴文字。',
    )
  }
}
