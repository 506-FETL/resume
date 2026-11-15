export const EXPERIENCE_IMAGE_MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

export const EXPERIENCE_SPREADSHEET_MIMES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
}

export function experiencePreviewKind(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (Object.hasOwn(EXPERIENCE_IMAGE_MIMES, extension)) return 'image'
  if (Object.hasOwn(EXPERIENCE_SPREADSHEET_MIMES, extension))
    return 'spreadsheet'
  if (extension === 'pdf' || extension === 'docx') return extension
  if (['txt', 'md', 'markdown'].includes(extension)) return 'text'

  return null
}
