import type { ExperienceSource } from '@/lib/experience-sources/types'

export const KIND_LABEL = {
  file: '文件',
  pdf: 'PDF',
  docx: 'DOCX',
  text: 'TXT',
  markdown: 'Markdown',
  paste: '文字',
  image: '图片',
  spreadsheet: '表格',
}

export const STATUS_LABEL = {
  uploading: '保存中',
  'upload-failed': '保存失败',
  ready: '可使用',
  deleting: '删除中',
  'delete-failed': '删除失败，可重试',
}

export function sourceReference(source: ExperienceSource) {
  return source.currentVersionId
    ? {
        sourceId: source.id,
        versionId: source.currentVersionId,
        name: source.name,
      }
    : null
}

export function experienceError(error: unknown) {
  return error instanceof Error ? error.message : '暂时无法完成，请重试。'
}

export function formatSourceDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
