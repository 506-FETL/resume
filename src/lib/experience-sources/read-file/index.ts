import { checkAbort, createFileContent, decodeText } from './shared'
import type { ExperienceFileContent } from './shared'

export type { ExperienceFileContent } from './shared'

export async function readExperienceFile(
  blob: Blob,
  fileName: string,
  signal?: AbortSignal,
): Promise<ExperienceFileContent> {
  checkAbort(signal)

  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  const supported = [
    'pdf',
    'docx',
    'txt',
    'md',
    'markdown',
    'csv',
    'xls',
    'xlsx',
  ]

  if (!supported.includes(extension))
    throw new Error(
      '文件已保存，但暂不支持读取这种格式的文字。可以下载原件查看。',
    )

  const data = await blob.arrayBuffer()

  checkAbort(signal)

  try {
    if (!data.byteLength) return createFileContent('')
    if (extension === 'pdf') {
      const { readPdf } = await import('./pdf')

      return await readPdf(data, signal)
    }
    if (extension === 'docx') {
      const { readDocx } = await import('./docx')

      return await readDocx(data, signal)
    }
    if (['csv', 'xls', 'xlsx'].includes(extension)) {
      const { readSpreadsheet } = await import('./spreadsheet')

      return await readSpreadsheet(data, extension, signal)
    }

    const text = decodeText(data)

    if (text.includes('\0'))
      throw new Error('文件包含二进制内容，无法作为文字读取。')

    checkAbort(signal)

    return createFileContent(text)
  } catch (error) {
    checkAbort(signal)

    if (error instanceof TypeError && /module|fetch/i.test(error.message))
      throw new Error('无法加载文件读取器，请重试。')

    throw error
  }
}
