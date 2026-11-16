import { MAX_RESUME_FILE_BYTES } from '../const'
import type { ExtractedResumeFile } from '../types'
import { ResumeImportError } from '../types'
import { extractDocx } from './docx'
import { checkAbort, readFile } from './file-input'
import { extractPdf } from './pdf'

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
    const extracted =
      extension === 'pdf'
        ? await extractPdf(data, signal)
        : await extractDocx(data, signal)

    checkAbort(signal)

    return { ...extracted, sourceName: file.name }
  } catch (error) {
    checkAbort(signal)

    if (error instanceof ResumeImportError) throw error

    throw new ResumeImportError(
      'corrupt',
      '文件已损坏或无法解析，请重新保存文件，或粘贴文字。',
    )
  }
}
