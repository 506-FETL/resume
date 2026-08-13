import type { ReactNode } from 'react'
import { FileText, Printer } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import useResumeExportStore from '@/store/resume/export'

interface ExportDialogProps {
  trigger: ReactNode
}

export default function ExportDialog({ trigger }: ExportDialogProps) {
  const { exportToPdf, exportToDoc, documentState } = useResumeExportStore()
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const handleExportPdf = async () => {
    setExportDialogOpen(false)
    await exportToPdf()
  }

  const handleExportDoc = () => {
    setExportDialogOpen(false)
    exportToDoc()
  }

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出简历</DialogTitle>
          <DialogDescription>
            PDF 保持页面排版；Word 可能根据打开设备的字体可用性替换字体。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={documentState.status !== 'ready'}
            title={documentState.error ?? undefined}
          >
            <Printer data-icon="inline-start" />
            {documentState.status === 'measuring'
              ? '准备中…'
              : documentState.status === 'error'
                ? '分页失败'
                : '导出 PDF'}
          </Button>
          <Button onClick={handleExportDoc}>
            <FileText data-icon="inline-start" />
            导出 Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
