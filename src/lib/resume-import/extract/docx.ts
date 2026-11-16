import { createExperienceBlocks } from '../../experience-sources/extract'
import { MAX_DOCX_EXPANDED_BYTES, MAX_DOCX_XML_BYTES } from '../const'
import type { ExtractedResumeFile } from '../types'
import { ResumeImportError } from '../types'
import { checkAbort, validateText } from './file-input'

/** 先检查 ZIP 目录，不解压图片；正文再以 1 KB 输入分块解压并检查真实输出。 */
export async function extractDocx(
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<Pick<ExtractedResumeFile, 'text' | 'blocks'>> {
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
    .flatMap(([, part]) => docxXmlToText(part.chunks))

  const joined = output.join('\n')
  const text = validateText(joined)
  const leading = joined.length - joined.trimStart().length
  let offset = -leading

  const ranges = output.map((paragraph) => {
    const range = {
      start: Math.max(0, offset),
      end: Math.min(text.length, offset + paragraph.length),
    }

    offset += paragraph.length + 1

    return range
  })

  return { text, blocks: createExperienceBlocks(text, ranges) }
}

export function docxXmlToText(chunks: Uint8Array[]): string[] {
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

  return paragraphs
}
