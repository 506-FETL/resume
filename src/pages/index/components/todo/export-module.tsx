import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ExportModuleProps {
  lastExportDays: number
}

export function ExportModule({ lastExportDays }: ExportModuleProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      toast.success('简历导出成功')
    }
    catch {
      toast.error('导出失败，请重试')
    }
    finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="hidden md:block absolute -left-2 top-1 bottom-0 w-px bg-border/50" />
      <div className="flex items-center gap-2 mb-2.5">
        <Download className="size-3.5 text-blue-500" />
        <h4 className="font-medium text-xs">版本管理</h4>
      </div>
      <div className="bg-blue-50/80 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100/80 dark:border-blue-900/20 flex-1 flex flex-col">
        <div className="flex-1">
          <p className="text-xs text-blue-700/90 dark:text-blue-400/90 mb-1">
            上次导出是 <span className="font-semibold">{lastExportDays}</span> 天前
          </p>
          <p className="text-[10px] text-muted-foreground">
            建议更新版本以匹配最新求职意向
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 w-full mt-2.5 text-xs bg-blue-500 hover:bg-blue-600 text-white"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting
            ? (
                <>
                  <Loader2 className="size-3 mr-1.5 animate-spin" />
                  导出中
                </>
              )
            : (
                <>
                  <Download className="size-3 mr-1.5" />
                  一键导出
                </>
              )}
        </Button>
      </div>
    </div>
  )
}
