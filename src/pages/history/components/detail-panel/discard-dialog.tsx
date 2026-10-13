import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useHistoryDialogMotion } from '../../hooks/use-history-dialog-motion'

interface DetailDiscardDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function DetailDiscardDialog({ open, onCancel, onConfirm }: DetailDiscardDialogProps) {
  const dialogMotion = useHistoryDialogMotion()
  return (
    <AlertDialog open={open} onOpenChange={nextOpen => !nextOpen && onCancel()}>
      <AlertDialogContent size="sm" className={dialogMotion.contentClassName} overlayClassName={dialogMotion.overlayClassName}>
        <style>{dialogMotion.styles}</style>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
          <AlertDialogDescription>
            当前修改尚未保存。切换版本或关闭右侧面板后，这些修改将不会保留。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>放弃修改</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
