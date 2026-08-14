import type { MouseEvent } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'
import useShareStore from '../../store'
import { findShareById } from '../../utils'

export default function DeleteDialog() {
  const {
    allShares,
    shares,
    deleteDialogOpen,
    deleteShareId,
    pendingShareIds,
    closeDeleteDialog,
    remove,
  } = useShareStore()
  const share = findShareById(allShares, shares, deleteShareId)
  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(null)
  const renderedShare = share
    ?? (retainedShare?.id === deleteShareId ? retainedShare : null)
  const busy = Boolean(deleteShareId && pendingShareIds.includes(deleteShareId))

  useEffect(() => {
    if (share)
      setRetainedShare(share)
  }, [share])

  const handleDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!deleteShareId)
      return

    try {
      await remove(deleteShareId)
      toast.success('分享链接已永久删除')
    }
    catch {
      toast.error('删除失败')
    }
  }

  return (
    <AlertDialog
      open={deleteDialogOpen}
      onOpenChange={(open) => {
        if (!open)
          closeDeleteDialog()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>永久删除分享链接？</AlertDialogTitle>
          <AlertDialogDescription>
            删除「
            {renderedShare?.label || '未命名链接'}
            」后，全部发布批次、访问记录和评论都会永久删除且无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!deleteShareId || busy}
            onClick={handleDelete}
          >
            {busy && <Spinner data-icon="inline-start" />}
            永久删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
