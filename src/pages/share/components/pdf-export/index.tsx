import type { RefObject } from 'react'
import type { ResumeDocumentState } from '@/components/resume/pagination/types'
import { FileDown } from 'lucide-react'
import { useResumePrint } from '@/components/resume/pagination/use-resume-print'
import { Button } from '@/components/ui/button'

interface SharePdfExportProps {
  contentRef: RefObject<HTMLDivElement | null>
  documentState: ResumeDocumentState
  documentTitle: string
}

export default function SharePdfExport({
  contentRef,
  documentState,
  documentTitle,
}: SharePdfExportProps) {
  const handlePrint = useResumePrint({
    contentRef,
    documentState,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
  })

  return (
    <Button
      variant="outline"
      disabled={documentState.status !== 'ready'}
      title={documentState.error ?? undefined}
      onClick={() => handlePrint().catch(() => undefined)}
    >
      <FileDown data-icon="inline-start" />
      {documentState.status === 'measuring'
        ? '准备中…'
        : documentState.status === 'error'
          ? '分页失败'
          : '下载 PDF'}
    </Button>
  )
}
