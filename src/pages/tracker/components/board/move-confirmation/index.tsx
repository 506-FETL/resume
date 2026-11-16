import type { RefCallback } from 'react'
import type { ApplicationStatus } from '../../../types'
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
import { TRACKER_SEARCH_INPUT_ID } from '../../../const'

interface MoveConfirmationProps {
  pendingMove: { jobId: string; newStatus: ApplicationStatus } | null
  setPendingMove: (value: null) => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  pendingMoveJobIdRef: React.RefObject<string | null>
  focusCancel: RefCallback<HTMLButtonElement>
  commitMove: (jobId: string, status: ApplicationStatus) => void
}

export function MoveConfirmation({
  pendingMove,
  setPendingMove,
  scrollContainerRef,
  pendingMoveJobIdRef,
  focusCancel,
  commitMove,
}: MoveConfirmationProps) {
  return (
    <AlertDialog
      open={pendingMove !== null}
      onOpenChange={(open) => !open && setPendingMove(null)}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          const card = scrollContainerRef.current?.querySelector<HTMLElement>(
            `[data-motion-drag-item="${CSS.escape(pendingMoveJobIdRef.current ?? '')}"]`,
          )

          const fallback = document.getElementById(TRACKER_SEARCH_INPUT_ID)
          const target = card ?? fallback

          target?.focus({ preventScroll: true })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingMove?.newStatus === 'offer'
              ? '确认移动到「已录用」？'
              : '确认移动到「已结束」？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingMove?.newStatus === 'offer'
              ? '将把该职位标记为已录用。'
              : '将把该职位标记为结束流程，可在「已结束」列或筛选下查看。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            ref={focusCancel}
            onClick={() => setPendingMove(null)}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingMove)
                commitMove(pendingMove.jobId, pendingMove.newStatus)

              setPendingMove(null)
            }}
          >
            确认
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
