import { createDeferredComponent } from '@/components/deferred-content'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog'

const AnalysisProgress = createDeferredComponent(
  () => import('./progress'),
  '分析进度',
)

interface AnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AnalysisDialog({ open, onOpenChange }: AnalysisDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName='h-[min(85dvh,760px)] gap-0 sm:max-w-2xl'
    >
      <ResponsiveDialogContent className='min-h-0 flex-col overflow-hidden p-0'>
        <ResponsiveDialogHeader className='px-6 pt-6 pb-2 shrink-0 border-b'>
          <ResponsiveDialogTitle>ATS 分析过程</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            分析结果仅供参考，请核对后再应用修改。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <AnalysisProgress />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
