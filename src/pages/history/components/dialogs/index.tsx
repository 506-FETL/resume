import { useRef } from 'react'
import { deferDialog } from '@/components/deferred-dialog'
import type { HistoryDialogsProps } from './content'

const DeferredActions = deferDialog(
  () => import('./content'),
  '版本操作',
  'HistoryDialogs',
)

export default function HistoryDialogs(props: HistoryDialogsProps) {
  const {
    restoreTargetId,
    deleteTargetId,
    onCloseRestore,
    onCloseDelete,
    returnFocusTo,
  } = props

  const openerRef = useRef<HTMLElement | null>(null)

  if (restoreTargetId || deleteTargetId)
    openerRef.current = returnFocusTo ?? null

  return (
    <DeferredActions
      open={Boolean(restoreTargetId || deleteTargetId)}
      onClose={restoreTargetId ? onCloseRestore : onCloseDelete}
      loadingTitle={restoreTargetId ? '恢复此版本' : '删除此版本'}
    >
      {(Dialogs, opener) => (
        <Dialogs {...props} returnFocusTo={openerRef.current ?? opener} />
      )}
    </DeferredActions>
  )
}
