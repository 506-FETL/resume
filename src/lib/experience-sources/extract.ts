import type { ExtractedExperienceFile, ExperienceSourceBlock } from './types'
import {
  EXPERIENCE_EXTRACTOR_VERSION,
  EXPERIENCE_MAX_TEXT,
  EXPERIENCE_MAX_BLOCK_TEXT,
} from './const'
import { ResumeImportError } from '../resume-import/types'

export function createExperienceBlocks(
  text: string,
  ranges: { start: number; end: number; page?: number }[],
): ExperienceSourceBlock[] {
  const blocks: ExperienceSourceBlock[] = []

  for (const range of ranges) {
    let start = range.start

    while (start < range.end) {
      let end = Math.min(start + EXPERIENCE_MAX_BLOCK_TEXT, range.end)

      if (end < range.end) {
        const segment = text.slice(start, end)

        const boundary = Math.max(
          segment.lastIndexOf('\n'),
          segment.lastIndexOf('。'),
          segment.lastIndexOf('；'),
          segment.lastIndexOf(' '),
        )

        if (boundary > EXPERIENCE_MAX_BLOCK_TEXT / 2) end = start + boundary + 1
        if (/^[\uDC00-\uDFFF]$/.test(text[end])) end--
      }

      const content = text.slice(start, end)

      if (content.trim()) {
        blocks.push({
          id: `b${String(blocks.length + 1).padStart(4, '0')}`,
          text: content,
          start,
          end,
          ...(range.page ? { page: range.page } : {}),
        })
      }

      start = end
    }
  }

  return blocks
}

export function extractExperienceText(
  input: string,
  sourceName = '职业背景与经历',
): ExtractedExperienceFile {
  const text = input.replace(/\r\n?/g, '\n').trim()

  if (!text) throw new ResumeImportError('empty', '请先填写资料内容。')
  if (text.length > EXPERIENCE_MAX_TEXT)
    throw new ResumeImportError(
      'too-much-text',
      '文字超过 60000 字符，请删减后保存。',
    )

  const ranges = Array.from(
    text.matchAll(/[^\n]+(?:\n(?![\t ]*\n)[^\n]+)*/g),
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }),
  )

  return {
    text,
    sourceName,
    kind: 'paste',
    blocks: createExperienceBlocks(text, ranges),
    extractorVersion: EXPERIENCE_EXTRACTOR_VERSION,
  }
}
