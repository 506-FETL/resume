import { createExperienceBlocks } from '../extract'
import type { ExperienceSourceBlock } from '../types'

export interface ExperienceFileContent {
  text: string
  blocks: ExperienceSourceBlock[]
  warning?: string
}

export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')
}

export function createFileContent(
  text: string,
  ranges = Array.from(
    text.matchAll(/[^\n]+(?:\n(?![\t ]*\n)[^\n]+)*/g),
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }),
  ),
  warning?: string,
): ExperienceFileContent {
  const blocks = createExperienceBlocks(text, ranges).map((block) => ({
    ...block,
    id: `f1-${block.id}`,
  }))

  return {
    text,
    blocks,
    ...(warning || !blocks.length
      ? { warning: warning || '文件中没有可读取的文字。' }
      : {}),
  }
}

export function decodeText(data: ArrayBuffer) {
  const bytes = new Uint8Array(data)
  let encoding = 'utf-8'

  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'

  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    if (encoding !== 'utf-8') throw new Error('文字编码不完整，无法读取文件。')

    try {
      return new TextDecoder('gb18030', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('无法识别文字编码，请将文件另存为 UTF-8 后读取。')
    }
  }
}
