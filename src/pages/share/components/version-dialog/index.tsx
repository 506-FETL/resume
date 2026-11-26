import type { VersionDialogSelection } from '../../types'
import type { ResumeHistoryShareOption } from '@/lib/supabase/resume/history'
import type {
  CurrentResumeShareSnapshotProvider,
  ResumeShareRecord,
} from '@/lib/supabase/resume/share.types'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import useUserStore from '@/store/user'
import { getShareVersionOption } from '@/lib/supabase/resume/share/option-pages'
import { invalidateShareVersionPages } from '../../store/data/option-pages'
import { shareReadGeneration } from '../../store/data/requests'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import useShareStore from '../../store'
import { useShareDialogFocus } from '../../hooks/use-share-dialog-focus'
import {
  findShareById,
  isPublishableVersionSelection,
  toVersionDialogSelection,
} from '../../utils'
import VersionSelector from '../version-selector'
import { getDeletedSelection, checkShareVersionOption } from './source-option'

interface VersionDialogProps {
  returnFocusTo?: HTMLElement | null
  getCurrentSnapshot: CurrentResumeShareSnapshotProvider
}

export default function VersionDialog({
  returnFocusTo,
  getCurrentSnapshot,
}: VersionDialogProps) {
  const versionDialogOpen = useShareStore((state) => state.versionDialogOpen)
  const versionShareId = useShareStore((state) => state.versionShareId)

  const pending = useShareStore((state) =>
    Boolean(
      state.versionShareId &&
      state.pendingShareIds.includes(state.versionShareId),
    ),
  )

  const share = useShareStore((state) =>
    findShareById(state.pageShares, state.shares, state.versionShareId),
  )

  const { publishRelease, closeVersionDialog } = useShareStore.getState()
  const dialogFocus = useShareDialogFocus(returnFocusTo)

  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(
    null,
  )

  const renderedShare =
    share ?? (retainedShare?.id === versionShareId ? retainedShare : null)

  const [selection, setSelection] = useState<VersionDialogSelection>({
    kind: 'current',
  })

  const [submitting, setSubmitting] = useState(false)
  const initializedShareIdRef = useRef<string | null>(null)

  const busy = submitting || pending

  const ownerId = useUserStore((state) => state.currentUser?.id)
  const [checkFailed, setCheckFailed] = useState(false)
  const [checkAttempt, setCheckAttempt] = useState(0)
  const [picked, setPicked] = useState<ResumeHistoryShareOption | null>(null)

  useEffect(() => {
    if (share) setRetainedShare(share)
  }, [share])

  useEffect(() => {
    if (!versionDialogOpen || !renderedShare) return
    if (initializedShareIdRef.current === renderedShare.id) return

    initializedShareIdRef.current = renderedShare.id
    setSelection(toVersionDialogSelection(renderedShare.source))

    setPicked(null)
  }, [renderedShare, versionDialogOpen])

  useEffect(() => {
    if (versionDialogOpen) return

    initializedShareIdRef.current = null
  }, [versionDialogOpen])

  const source = renderedShare?.source
  const resumeId = renderedShare?.resume_id
  const sourceId = source?.kind === 'history' ? source.versionId : null

  const applySourceCheck = useEffectEvent(
    (checkedId: number, existing: ResumeHistoryShareOption | null) => {
      if (existing) {
        setPicked((previous) => previous ?? existing)

        return
      }
      if (!renderedShare) return

      const deleted = getDeletedSelection(checkedId, null, renderedShare)

      if (deleted)
        setSelection((previous) =>
          previous.kind === 'history' && previous.versionId === checkedId
            ? deleted
            : previous,
        )
    },
  )

  useEffect(() => {
    if (!versionDialogOpen || !ownerId || !resumeId || sourceId == null) return

    let active = true

    setCheckFailed(false)

    checkShareVersionOption(ownerId, resumeId, sourceId)
      .then((existing) => {
        if (active) applySourceCheck(sourceId, existing)
      })
      .catch(() => {
        if (active) setCheckFailed(true)
      })

    return () => {
      active = false
    }
  }, [
    ownerId,
    versionDialogOpen,
    versionShareId,
    resumeId,
    sourceId,
    checkAttempt,
  ])

  const handlePublish = async () => {
    if (busy || !renderedShare || !isPublishableVersionSelection(selection))
      return

    if (
      renderedShare.purpose === 'application' &&
      selection.kind === 'current'
    ) {
      toast.error('正式投递链接需要固定版本，请选择历史版本')

      return
    }

    const submittedSelection = selection
    const generation = shareReadGeneration

    setSubmitting(true)

    try {
      const { resolveResumeShareRelease } =
        await import('@/lib/supabase/resume/share/release-source')

      const release = await resolveResumeShareRelease({
        resumeId: renderedShare.resume_id,
        displayName: renderedShare.display_name,
        selection: submittedSelection,
        getCurrentSource: getCurrentSnapshot,
      })

      await publishRelease(renderedShare.id, release)
      toast.success('已发布所选版本')
      closeVersionDialog()
    } catch (error) {
      if (
        submittedSelection.kind === 'history' &&
        ownerId &&
        generation === shareReadGeneration
      ) {
        const deleted = getDeletedSelection(
          submittedSelection.versionId,
          picked,
          renderedShare,
        )

        const existing = await getShareVersionOption(
          ownerId,
          renderedShare.resume_id,
          submittedSelection.versionId,
        ).catch(() => undefined)

        if (generation !== shareReadGeneration) return
        if (deleted && existing === null) {
          invalidateShareVersionPages(renderedShare.resume_id)
          setSelection(deleted)
          toast.error('所选历史版本已删除，请重新选择')

          return
        }
      }

      toast.error(error instanceof Error ? error.message : '发布失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={versionDialogOpen}
      onOpenChange={(open) => {
        if (!open && !busy) closeVersionDialog()
      }}
    >
      <DialogContent
        {...dialogFocus}
        className='flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col overflow-hidden sm:max-w-lg'
      >
        <DialogHeader className='shrink-0 pr-6'>
          <DialogTitle>更换分享版本</DialogTitle>
          <DialogDescription>
            发布后原链接保持不变，访问者刷新即可看到所选版本。
          </DialogDescription>
        </DialogHeader>

        <div className='scrollbar-thin-subtle min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain'>
          <VersionSelector
            value={selection}
            currentDisabled={renderedShare?.purpose === 'application'}
            historyDisabled={
              renderedShare?.purpose === 'review' ||
              renderedShare?.purpose === 'showcase'
            }
            key={renderedShare?.id}
            resumeId={resumeId ?? null}
            selectedVersion={picked}
            source={source}
            disabled={!versionDialogOpen || !renderedShare || busy}
            onChange={(next, version) => {
              setSelection(next)
              setPicked(version ?? null)
            }}
          />
          {checkFailed &&
            selection.kind === 'history' &&
            selection.versionId === sourceId && (
              <div
                role='alert'
                className='flex items-center justify-between gap-2 text-sm text-muted-foreground'
              >
                暂时无法确认所选版本是否仍然可用。
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setCheckAttempt((n) => n + 1)}
                >
                  重试
                </Button>
              </div>
            )}
          {selection.kind === 'deleted-history' && (
            <p className='rounded-md bg-destructive/8 px-3 py-2 text-sm text-destructive'>
              原历史版本已删除，当前链接仍保留发布时的快照。请选择新的版本后再发布。
            </p>
          )}
          {renderedShare?.purpose === 'application' && (
            <p className='text-xs text-muted-foreground'>
              正式投递只允许发布固定的历史版本。
            </p>
          )}
          <p className='text-xs text-muted-foreground'>
            {selection.kind === 'current'
              ? '当前简历保存后自动同步到这个链接。'
              : '历史版本分享为固定内容，不随当前简历编辑变化。'}
          </p>
        </div>

        <DialogFooter className='shrink-0'>
          <Button
            variant='outline'
            disabled={busy}
            onClick={closeVersionDialog}
          >
            取消
          </Button>
          <Button
            disabled={
              !renderedShare ||
              busy ||
              !isPublishableVersionSelection(selection)
            }
            onClick={handlePublish}
          >
            {busy && <Spinner data-icon='inline-start' />}
            {busy ? '正在发布…' : '发布所选版本'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
