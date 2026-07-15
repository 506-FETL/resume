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
  const { exportToPdf, exportToDoc } = useResumeExportStore()
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
          <DialogDescription>选择导出格式，导出内容将与页面预览保持一致。</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleExportPdf}>
            <Printer className="mr-2 size-4" />
            导出 PDF
          </Button>
          <Button onClick={handleExportDoc}>
            <FileText className="mr-2 size-4" />
            导出 Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
