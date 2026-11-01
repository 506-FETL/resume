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

interface ConversationDeleteDialogProps {
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  returnFocus: () => HTMLElement | null
}

export function ConversationDeleteDialog({
  title,
  open,
  onOpenChange,
  onConfirm,
  returnFocus,
}: ConversationDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        size='sm'
        className='max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto wrap-anywhere'
        onCloseAutoFocus={(event) => {
          const target = returnFocus()

          if (target?.isConnected) {
            event.preventDefault()
            target.focus({ preventScroll: true })
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除该会话？</AlertDialogTitle>
          <AlertDialogDescription>
            {`「${title}」及其全部消息将被永久删除，无法恢复。`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            onClick={onConfirm}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
