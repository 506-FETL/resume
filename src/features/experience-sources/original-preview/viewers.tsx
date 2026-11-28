import { createDeferredComponent } from '@/components/deferred-content'
import { OriginalPreviewPlaceholder } from './placeholder'
import { loadPdfEngine } from './pdf-engine'

export const PdfPreview = createDeferredComponent(
  async () => {
    const [viewer] = await Promise.all([
      import('./pdf-preview'),
      loadPdfEngine(),
    ])

    return viewer
  },
  'PDF 预览',
  <OriginalPreviewPlaceholder kind='pdf' />,
  { wrapFallback: false },
)

export const DocxPreview = createDeferredComponent(
  () => import('./docx-preview'),
  'DOCX 预览',
  <OriginalPreviewPlaceholder kind='docx' />,
  { wrapFallback: false },
)

export const SpreadsheetPreview = createDeferredComponent(
  () => import('./spreadsheet-preview'),
  '表格预览',
  <OriginalPreviewPlaceholder kind='spreadsheet' />,
  { wrapFallback: false },
)

export const ImagePreview = createDeferredComponent(
  () => import('./image-preview'),
  '图片预览',
  <OriginalPreviewPlaceholder kind='image' />,
  { wrapFallback: false },
)
