import type { RestoreStrategy } from '../../types'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useHistoryDialogMotion } from '../../hooks/use-history-dialog-motion'
import useHistoryStore from '../../store'
import RestoreVersionDialog from './restore-version-dialog'

interface HistoryDialogsProps {
  restoreTargetId: number | null
  deleteTargetId: number | null
  onCloseRestore: () => void
  onConfirmRestore: (strategy: RestoreStrategy) => Promise<void>
  onCloseDelete: () => void
  onConfirmDelete: () => Promise<void>
}

export default function HistoryDialogs({
  restoreTargetId,
  deleteTargetId,
  onCloseRestore,
  onConfirmRestore,
  onCloseDelete,
  onConfirmDelete,
}: HistoryDialogsProps) {
  const { versions, restoring, deletingVersionId } = useHistoryStore()
  const dialogMotion = useHistoryDialogMotion()

  const [restoreStrategy, setRestoreStrategy] =
    useState<RestoreStrategy | null>(null)

  const restoreTarget = versions.find(
    (version) => version.id === restoreTargetId,
  )

  const deleteTarget = versions.find((version) => version.id === deleteTargetId)
  const [retainedDeleteTarget, setRetainedDeleteTarget] = useState(deleteTarget)
  const displayedDeleteTarget = deleteTarget ?? retainedDeleteTarget

  useEffect(() => {
    if (deleteTarget) setRetainedDeleteTarget(deleteTarget)
  }, [deleteTarget])

  useEffect(() => {
    if (!restoring) {
      setRestoreStrategy(null)
    }
  }, [restoring])

  const handleRestore = async (strategy: RestoreStrategy) => {
    setRestoreStrategy(strategy)
    await onConfirmRestore(strategy)
  }

  return (
    <>
      <RestoreVersionDialog
        targetVersion={restoreTarget ?? null}
        restoring={restoring}
        restoreStrategy={restoreStrategy}
        onOpenChange={() => onCloseRestore()}
        onConfirm={handleRestore}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingVersionId) {
            onCloseDelete()
          }
        }}
      >
        <AlertDialogContent
          className={dialogMotion.contentClassName}
          overlayClassName={dialogMotion.overlayClassName}
        >
          <style>{dialogMotion.styles}</style>
          <AlertDialogHeader>
            <AlertDialogMedia className='bg-destructive/10 text-destructive'>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>删除此版本？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，V
              {displayedDeleteTarget?.version_no}
              的说明、标签、内容和内部评论将永久删除；当前正在编辑的内容和已发布分享不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingVersionId)}>
              取消
            </AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={Boolean(deletingVersionId)}
              onClick={onConfirmDelete}
            >
              {deletingVersionId && (
                <LoaderCircle
                  data-icon='inline-start'
                  className={cn(!dialogMotion.reduceMotion && 'animate-spin')}
                />
              )}
              {deletingVersionId ? '删除中...' : '确认删除'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
