import { PDFDocument } from 'npm:pdf-lib@1.17.1'
import type { ExtractedExperienceFile } from '../shared/experience-source-contract.ts'
import { EXPERIENCE_MAX_BYTES } from '../shared/experience-source-contract.ts'
import { validateSubmissionFile } from '../job-submissions/files.ts'
import { ExperienceRequestError } from './input.ts'
import {
  EXPERIENCE_IMAGE_MIMES,
  EXPERIENCE_SPREADSHEET_MIMES,
} from '../shared/experience-file-formats.ts'

export async function validateExperienceFile(
  file: File | null,
  extracted: ExtractedExperienceFile,
) {
  if (extracted.kind === 'paste') {
    if (file)
      throw new ExperienceRequestError(
        'invalid_request',
        '粘贴文字不能附带原文件。',
      )

    return { fileName: null, fileMime: null, fileSize: null }
  }
  if (!file || !file.size || file.size > EXPERIENCE_MAX_BYTES)
    throw new ExperienceRequestError(
      'too_large',
      '请选择 10 MB 以内的原文件。',
      413,
    )

  if (extracted.sourceName !== file.name)
    throw new ExperienceRequestError(
      'invalid_request',
      '原文件名称与提取记录不一致，请重新读取。',
    )

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  const expected = {
    pdf: ['pdf'],
    docx: ['docx'],
    text: ['txt'],
    markdown: ['md', 'markdown'],
    image: Object.keys(EXPERIENCE_IMAGE_MIMES),
    spreadsheet: Object.keys(EXPERIENCE_SPREADSHEET_MIMES),
  }[extracted.kind]

  if (!expected.includes(extension ?? '') || file.name.length > 255)
    throw new ExperienceRequestError(
      'invalid_request',
      '原文件格式与提取内容不一致。',
    )

  const mime = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    text: 'text/plain',
    markdown: 'text/markdown',
    image: EXPERIENCE_IMAGE_MIMES[extension],
    spreadsheet: EXPERIENCE_SPREADSHEET_MIMES[extension],
  }[extracted.kind]

  try {
    if (extracted.kind === 'pdf' || extracted.kind === 'docx') {
      await validateSubmissionFile(new File([file], file.name, { type: mime }))

      if (extracted.kind === 'pdf') {
        const document = await PDFDocument.load(await file.arrayBuffer())

        if (
          document.getPageCount() > 30 ||
          extracted.blocks.some(
            (block) => (block.page ?? 0) > document.getPageCount(),
          )
        )
          throw new Error('PDF 页数或段落页码无效，请保留 30 页以内的内容。')
      }
    } else if (
      extracted.kind === 'image' ||
      (extracted.kind === 'spreadsheet' && extension !== 'csv')
    ) {
      const { fileTypeFromBuffer } = await import('npm:file-type@22.3.0')

      const detected = await fileTypeFromBuffer(
        new Uint8Array(await file.arrayBuffer()),
      )

      const isLegacyExcel =
        extension === 'xls' &&
        (detected?.ext === 'cfb' || detected?.ext === 'xls')

      if (!isLegacyExcel && detected?.mime !== mime)
        throw new Error('文件内容与扩展名不符，请选择完整的原文件。')
    } else {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        await file.arrayBuffer(),
      )

      if (
        text.includes('\0') ||
        (extracted.kind !== 'spreadsheet' &&
          text.replace(/\r\n?/g, '\n').trim() !== extracted.text)
      )
        throw new Error('原文件文字与提取内容不一致，请重新读取。')
    }
  } catch (error) {
    throw new ExperienceRequestError(
      'invalid_file',
      error instanceof Error ? error.message : '原文件无法读取，请重新选择。',
    )
  }

  return { fileName: file.name, fileMime: mime, fileSize: file.size }
}
