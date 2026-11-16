import type { JobApplication } from '../../../types'
import type { useJobDrawer } from '../use-job-drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Props = { selectedJob: JobApplication } & Pick<
  ReturnType<typeof useJobDrawer>,
  | 'reduce'
  | 'confirmKind'
  | 'confirmOpen'
  | 'setConfirmOpen'
  | 'confirmTriggerRef'
  | 'closeButtonRef'
  | 'handleProgressChange'
  | 'handleReject'
  | 'handleDelete'
>

export function DrawerConfirmation({
  selectedJob,
  reduce,
  confirmKind,
  confirmOpen,
  setConfirmOpen,
  confirmTriggerRef,
  closeButtonRef,
  handleProgressChange,
  handleReject,
  handleDelete,
}: Props) {
  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent
        className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
        style={{
          animationDuration: `${reduce ? 0 : confirmOpen ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
        onOpenAutoFocus={() => {
          confirmTriggerRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          const trigger = confirmTriggerRef.current
          const target = trigger?.isConnected ? trigger : closeButtonRef.current

          target?.focus({ preventScroll: true })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmKind === 'delete'
              ? '确认删除该记录？'
              : confirmKind === 'jump-offer'
                ? '确认移动到「已录用」？'
                : '确认结束该流程？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmKind === 'delete'
              ? `「${selectedJob.company} - ${selectedJob.position}」将被永久删除，无法恢复。`
              : confirmKind === 'jump-offer'
                ? '将把该职位标记为已录用。'
                : '该职位将标记为「已结束」，已有阶段与面试记录会保留。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              confirmKind !== 'jump-offer' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
            onClick={() => {
              if (confirmKind === 'delete') handleDelete()
              else if (confirmKind === 'reject') handleReject()
              else if (confirmKind === 'jump-offer')
                handleProgressChange('offer')
            }}
          >
            {confirmKind === 'delete'
              ? '删除'
              : confirmKind === 'jump-offer'
                ? '确认'
                : '结束流程'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
