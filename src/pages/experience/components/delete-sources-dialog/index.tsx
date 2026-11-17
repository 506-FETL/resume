import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useExperiencePageStore } from '../../store'

export default function DeleteSourcesDialog() {
  const {
    deleteOpen,
    deleteTargets,
    deleting,
    deleteProgress,
    deleteError,
    setDeleteOpen,
    deleteSources,
  } = useExperiencePageStore()

  const reduced = useReducedMotion()

  return (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent
        inert={!deleteOpen}
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-lg'
        style={reduced ? { animationDuration: '0s' } : undefined}
        onCloseAutoFocus={(event) => {
          if (deleteError || !deleteProgress.completed) return

          event.preventDefault()

          const target =
            document.querySelector<HTMLButtonElement>(
              '[data-experience-selection]:not(:disabled)',
            ) ??
            document.querySelector<HTMLButtonElement>(
              '[data-experience-upload]',
            )

          target?.focus({ preventScroll: true })
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            删除
            {deleteTargets.length === 1
              ? '这份'
              : `这 ${deleteTargets.length} 份`}
            资料？
          </AlertDialogTitle>
          <AlertDialogDescription>
            文件、文字内容与全部版本将被删除，后续无法继续引用。已发送的聊天文字仍会保留。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul
          aria-label='待删除资料'
          className='max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm'
        >
          {deleteTargets.map((source) => (
            <li key={source.id} className='break-words'>
              {source.name}
            </li>
          ))}
        </ul>
        {deleteError && (
          <p role='alert' className='text-sm text-destructive'>
            {deleteError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <Button
            variant='destructive'
            disabled={deleting}
            onClick={deleteSources}
            aria-live='polite'
            aria-busy={deleting}
          >
            {deleting && <Spinner />}
            {deleting
              ? `正在删除 ${deleteProgress.completed}/${deleteProgress.total}`
              : deleteError
                ? '重试删除'
                : '删除资料'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
