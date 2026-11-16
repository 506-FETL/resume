import { createDeferredComponent } from '@/components/deferred-content'
import { Skeleton } from '@/components/ui/skeleton'
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
  <Skeleton className='aspect-[210/297] w-full' />,
  { wrapFallback: false },
)

export const DocxPreview = createDeferredComponent(
  () => import('./docx-preview'),
  'DOCX 预览',
  <Skeleton className='aspect-[210/297] w-full' />,
  { wrapFallback: false },
)

export const SpreadsheetPreview = createDeferredComponent(
  () => import('./spreadsheet-preview'),
  '表格预览',
  <Skeleton className='h-80 w-full' />,
  { wrapFallback: false },
)

export const ImagePreview = createDeferredComponent(
  () => import('./image-preview'),
  '图片预览',
  <Skeleton className='aspect-[4/3] w-full' />,
  { wrapFallback: false },
)
