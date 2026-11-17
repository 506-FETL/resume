import { docxXmlToText } from '../../resume-import/extract/docx-xml'
import { checkAbort, createFileContent } from './shared'

export async function readDocx(data: ArrayBuffer, signal?: AbortSignal) {
  const { unzip } = await import('fflate')

  checkAbort(signal)
  validateArchive(data)

  const parts = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) => {
      const abort = () => {
        cancel()
        reject(new DOMException('已取消读取文件', 'AbortError'))
      }

      const cancel = unzip(
        new Uint8Array(data),
        {
          filter: (entry) =>
            /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(entry.name),
        },
        (error, files) => {
          signal?.removeEventListener('abort', abort)

          if (error) reject(new Error('DOCX 解压失败，文件可能已损坏。'))
          else resolve(files)
        },
      )

      signal?.addEventListener('abort', abort, { once: true })
    },
  )

  checkAbort(signal)

  let paragraphs: string[]

  try {
    paragraphs = Object.entries(parts)
      .sort(([left], [right]) => {
        const rank = (name: string) =>
          name.includes('header') ? 0 : name.includes('footer') ? 2 : 1

        return rank(left) - rank(right) || left.localeCompare(right)
      })
      .flatMap(([, bytes]) => docxXmlToText([bytes]))
  } catch {
    throw new Error('DOCX 正文格式错误，未能读取文字。可以下载原件检查。')
  }

  const text = paragraphs.join('\n')
  let offset = 0

  const ranges = paragraphs.map((paragraph) => {
    const range = { start: offset, end: offset + paragraph.length }

    offset += paragraph.length + 1

    return range
  })

  checkAbort(signal)

  return createFileContent(text, ranges)
}

function validateArchive(data: ArrayBuffer) {
  const view = new DataView(data)
  const bytes = new Uint8Array(data)

  if (bytes[0] === 0xd0 && bytes[1] === 0xcf)
    throw new Error(
      'DOCX 可能受密码保护，暂时无法读取。请检查格式并解除密码保护。',
    )

  let end = bytes.length - 22

  while (
    end >= Math.max(0, bytes.length - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  )
    end--

  if (end < 0 || end < bytes.length - 65557)
    throw new Error('DOCX 文件目录不完整或已损坏，未能读取文字。')

  const entries = view.getUint16(end + 10, true)
  let cursor = view.getUint32(end + 16, true)
  let found = false

  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error('DOCX 文件目录已损坏，未能读取文字。')
    if (view.getUint16(cursor + 8, true) & 1)
      throw new Error('DOCX 受密码保护，暂时无法读取。请解除密码保护后再读取。')

    const nameLength = view.getUint16(cursor + 28, true)

    const next =
      cursor +
      46 +
      nameLength +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true)

    if (next > end) throw new Error('DOCX 文件目录已损坏，未能读取文字。')

    const name = new TextDecoder().decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    )

    if (name === 'word/document.xml') {
      if (found) throw new Error('DOCX 包含重复正文，无法读取文字。')

      found = true
    }

    cursor = next
  }

  if (!found) throw new Error('文件中没有 DOCX 正文，请检查文件格式。')
}
