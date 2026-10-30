import type { MouseEvent } from 'react'
import type { ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import { Spinner } from '@/components/ui/spinner'
import useShareStore from '../../store'
import { useShareDialogFocus } from '../../hooks/use-share-dialog-focus'
import { findShareById } from '../../utils'

export default function ArchiveDialog() {
  const {
    allShares,
    shares,
    archiveDialogOpen,
    archiveShareId,
    pendingShareIds,
    closeArchiveDialog,
    archive,
  } = useShareStore()

  const dialogFocus = useShareDialogFocus()
  const share = findShareById(allShares, shares, archiveShareId)

  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(
    null,
  )

  const renderedShare =
    share ?? (retainedShare?.id === archiveShareId ? retainedShare : null)

  const busy = Boolean(
    archiveShareId && pendingShareIds.includes(archiveShareId),
  )

  useEffect(() => {
    if (share) setRetainedShare(share)
  }, [share])

  const handleArchive = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    if (!archiveShareId) return

    try {
      await archive(archiveShareId)
      toast.success('分享已归档')
    } catch {
      toast.error('归档失败')
    }
  }

  return (
    <AlertDialog
      open={archiveDialogOpen}
      onOpenChange={(open) => {
        if (!open && !busy) closeArchiveDialog()
      }}
    >
      <AlertDialogContent
        {...dialogFocus}
        className='flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden'
      >
        <AlertDialogHeader className='min-h-0 overflow-y-auto overscroll-contain'>
          <AlertDialogTitle>归档分享链接？</AlertDialogTitle>
          <AlertDialogDescription className='break-words'>
            归档「
            {renderedShare?.label || '未命名链接'}
            」后，外部访问会立即失效；发布批次和评论仍会保留，之后可在评论来源中继续审阅。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className='shrink-0'>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={!archiveShareId || busy}
            onClick={handleArchive}
          >
            {busy && <Spinner data-icon='inline-start' />}
            确认归档
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
