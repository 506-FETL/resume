import {
  PdfPreview,
  DocxPreview,
  SpreadsheetPreview,
  ImagePreview,
} from './viewers'

export function prepareOriginalViewer(kind: string) {
  switch (kind) {
    case 'pdf':
      return PdfPreview.preload()
    case 'docx':
      return DocxPreview.preload()
    case 'spreadsheet':
      return SpreadsheetPreview.preload()
    case 'image':
      return ImagePreview.preload()
  }
}
