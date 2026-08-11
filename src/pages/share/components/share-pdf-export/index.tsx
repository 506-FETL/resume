import type { RefObject } from 'react'
import { FileDown } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'

interface SharePdfExportProps {
  contentRef: RefObject<HTMLDivElement | null>
  ready: boolean
  documentTitle: string
}

export default function SharePdfExport({ contentRef, ready, documentTitle }: SharePdfExportProps) {
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: documentTitle ? `${documentTitle}-简历` : '简历',
    pageStyle: `
      @page {
        size: A4;
        margin: 0;
      }
    `,
  })

  return (
    <Button variant="outline" disabled={!ready} onClick={() => handlePrint()}>
      <FileDown data-icon="inline-start" />
      {ready ? '下载 PDF' : '准备中…'}
    </Button>
  )
}
