import type { ExtractedExperienceFile, ExperienceSourceBlock } from './types'
import {
  EXPERIENCE_EXTRACTOR_VERSION,
  EXPERIENCE_MAX_BYTES,
  EXPERIENCE_MAX_TEXT,
  EXPERIENCE_MAX_BLOCK_TEXT,
} from './const'
import { ResumeImportError } from '../resume-import/types'
import {
  EXPERIENCE_IMAGE_MIMES,
  EXPERIENCE_SPREADSHEET_MIMES,
} from '../../../supabase/functions/shared/experience-file-formats'

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
  sourceName = '补充经历',
): ExtractedExperienceFile {
  const text = input.replace(/\r\n?/g, '\n').trim()

  if (!text) throw new ResumeImportError('empty', '请先填写经历文字。')
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

export async function extractExperienceFile(
  file: File,
  signal?: AbortSignal,
): Promise<ExtractedExperienceFile> {
  if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')
  if (!file.size) throw new ResumeImportError('empty', '文件为空，请重新选择。')
  if (file.size > EXPERIENCE_MAX_BYTES)
    throw new ResumeImportError('too-large', '文件超过 10 MB，请删减后保存。')

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (Object.hasOwn(EXPERIENCE_IMAGE_MIMES, extension)) {
    const { fileTypeFromBlob } = await import('file-type')
    const detected = await fileTypeFromBlob(file)

    if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')
    if (detected?.mime !== EXPERIENCE_IMAGE_MIMES[extension])
      throw new ResumeImportError(
        'corrupt',
        '图片格式与文件名不符，请选择原图片。',
      )

    return {
      text: '',
      blocks: [],
      kind: 'image',
      sourceName: file.name,
      extractorVersion: EXPERIENCE_EXTRACTOR_VERSION,
    }
  }

  if (Object.hasOwn(EXPERIENCE_SPREADSHEET_MIMES, extension)) {
    const { createSpreadsheetSession } = await import('./spreadsheet-session')
    const session = createSpreadsheetSession()
    const abort = () => session.dispose()

    signal?.addEventListener('abort', abort, { once: true })

    try {
      if (signal?.aborted)
        throw new DOMException('已取消读取文件', 'AbortError')

      await session.open(file, extension)

      const text = await session.extract()

      if (!text)
        throw new ResumeImportError(
          'empty',
          '表格中没有可读取的单元格内容，请填写后上传。',
        )

      return { ...extractExperienceText(text, file.name), kind: 'spreadsheet' }
    } finally {
      signal?.removeEventListener('abort', abort)
      session.dispose()
    }
  }

  if (extension === 'pdf' || extension === 'docx') {
    const { extractResumeFile } = await import('../resume-import/extract')
    const result = await extractResumeFile(file, signal)

    return {
      ...result,
      kind: extension,
      blocks: result.blocks,
      extractorVersion: EXPERIENCE_EXTRACTOR_VERSION,
    }
  }
  if (!['txt', 'md', 'markdown'].includes(extension ?? ''))
    throw new ResumeImportError(
      'unsupported',
      '支持 PDF、DOCX、Excel、CSV、常见图片、UTF-8 TXT 和 Markdown 文件。',
    )

  const bytes = await file.arrayBuffer()

  if (signal?.aborted) throw new DOMException('已取消读取文件', 'AbortError')

  let text: string

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ResumeImportError(
      'corrupt',
      '文件不是 UTF-8 文字，请转换编码后重新选择。',
    )
  }

  if (text.includes('\0'))
    throw new ResumeImportError(
      'corrupt',
      '文件包含非文字内容，请选择纯文本文件。',
    )

  return {
    ...extractExperienceText(text, file.name),
    kind: extension === 'txt' ? 'text' : 'markdown',
  }
}
