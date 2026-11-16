import type { InterviewSubStagesProps } from '../types'
import type { useInterviewRounds } from '../use-interview-rounds'
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

export function DeleteRoundDialog({
  model,
  subStages,
  onDeleteSubStage,
}: { model: ReturnType<typeof useInterviewRounds> } & Pick<
  InterviewSubStagesProps,
  'subStages' | 'onDeleteSubStage'
>) {
  const {
    reduce,
    setSelectedId,
    deletedRound,
    deleteOpen,
    setDeleteOpen,
    selectedRound,
    selectedIndex,
    triggerRefs,
    addRef,
    headingRef,
    deletedRef,
    exitingRoundIdRef,
    deleteTriggerRef,
  } = model

  return (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent
        className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto break-words'
        style={{
          animationDuration: `${reduce ? 0 : deleteOpen ? DURATION.base : DURATION.fast}s`,
          animationTimingFunction: `cubic-bezier(${EASE.out.join(',')})`,
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()

          if (deletedRef.current) {
            const target =
              (selectedRound && triggerRefs.current.get(selectedRound.id)) ||
              addRef.current ||
              headingRef.current

            target?.focus({ preventScroll: true })
          } else {
            deleteTriggerRef.current?.focus({ preventScroll: true })
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>删除这轮面试？</AlertDialogTitle>
          <AlertDialogDescription>
            「{deletedRound?.label || '该轮面试'}
            」的日期和笔记将一并删除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>保留</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            onClick={() => {
              const deleting = deletedRound?.id

              if (!deleting) return

              deletedRef.current = true
              exitingRoundIdRef.current = subStages.length > 1 ? deleting : null

              if (selectedRound?.id === deleting) {
                const next =
                  subStages[selectedIndex + 1] ?? subStages[selectedIndex - 1]

                setSelectedId(next?.id ?? '')
              }

              onDeleteSubStage(deleting)
            }}
          >
            删除轮次
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
