import type { VersionDialogSelection } from '../../types'
import type { ResumeHistoryVersionListItem } from '@/lib/supabase/resume/history'
import type { CurrentResumeShareSnapshotProvider, ResumeShareRecord } from '@/lib/supabase/resume/share.types'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { resolveResumeShareRelease } from '@/lib/supabase/resume/share'
import useShareStore from '../../store'
import { findShareById, isPublishableVersionSelection, toVersionDialogSelection } from '../../utils'
import VersionSelector from '../version-selector'

interface VersionDialogProps {
  getCurrentSnapshot: CurrentResumeShareSnapshotProvider
}

function getVersionLabel(version: ResumeHistoryVersionListItem) {
  return version.version_name?.trim()
    || version.milestone_name?.trim()
    || '未命名版本'
}

function getDeletedSelection(
  versionId: number,
  versions: ResumeHistoryVersionListItem[],
  share: ResumeShareRecord,
): VersionDialogSelection | null {
  const version = versions.find(item => item.id === versionId)
  if (version) {
    return {
      kind: 'deleted-history',
      versionNo: version.version_no,
      versionLabel: getVersionLabel(version),
      versionCreatedAt: version.created_at,
    }
  }

  if (
    share.source.kind === 'history'
    && share.source.versionId === versionId
  ) {
    return {
      kind: 'deleted-history',
      versionNo: share.source.versionNo,
      versionLabel: share.source.versionLabel,
      versionCreatedAt: share.source.versionCreatedAt,
    }
  }

  return null
}

export default function VersionDialog({
  getCurrentSnapshot,
}: VersionDialogProps) {
  const {
    allShares,
    shares,
    resumeMap,
    versionDialogOpen,
    versionShareId,
    versionOptionsByResumeId,
    pendingShareIds,
    loadVersionOptions,
    publishRelease,
    closeVersionDialog,
  } = useShareStore()
  const share = findShareById(allShares, shares, versionShareId)
  const [retainedShare, setRetainedShare] = useState<ResumeShareRecord | null>(null)
  const renderedShare = share
    ?? (retainedShare?.id === versionShareId ? retainedShare : null)
  const [selection, setSelection] = useState<VersionDialogSelection>({ kind: 'current' })
  const initializedShareIdRef = useRef<string | null>(null)
  const busy = Boolean(renderedShare && pendingShareIds.includes(renderedShare.id))
  const versionEntry = renderedShare
    ? versionOptionsByResumeId[renderedShare.resume_id]
    : undefined

  useEffect(() => {
    if (share)
      setRetainedShare(share)
  }, [share])

  useEffect(() => {
    if (!versionDialogOpen || !renderedShare)
      return
    if (initializedShareIdRef.current === renderedShare.id)
      return

    initializedShareIdRef.current = renderedShare.id
    setSelection(toVersionDialogSelection(renderedShare.source))
    loadVersionOptions(renderedShare.resume_id, { force: true }).catch(() => undefined)
  }, [loadVersionOptions, renderedShare, versionDialogOpen])

  useEffect(() => {
    if (versionDialogOpen)
      return
    initializedShareIdRef.current = null
  }, [versionDialogOpen])

  useEffect(() => {
    if (
      !versionDialogOpen
      || !renderedShare
      || !versionEntry?.loaded
      || versionEntry.loading
      || versionEntry.error
      || selection.kind !== 'history'
      || renderedShare.source.kind !== 'history'
      || selection.versionId !== renderedShare.source.versionId
      || versionEntry.items.some(version => version.id === selection.versionId)
    ) {
      return
    }

    const deleted = getDeletedSelection(
      selection.versionId,
      versionEntry.items,
      renderedShare,
    )
    if (deleted)
      setSelection(deleted)
  }, [renderedShare, selection, versionDialogOpen, versionEntry])

  const handlePublish = async () => {
    if (!renderedShare || !isPublishableVersionSelection(selection))
      return

    const submittedSelection = selection
    const versionsBeforePublish = versionEntry?.items ?? []
    try {
      const release = await resolveResumeShareRelease({
        resumeId: renderedShare.resume_id,
        displayName: resumeMap[renderedShare.resume_id]?.displayName
          ?? renderedShare.display_name,
        selection: submittedSelection,
        getCurrentSource: getCurrentSnapshot,
      })
      await publishRelease(renderedShare.id, release)
      toast.success('已发布所选版本')
      closeVersionDialog()
    }
    catch (error) {
      if (submittedSelection.kind === 'history') {
        const deleted = getDeletedSelection(
          submittedSelection.versionId,
          versionsBeforePublish,
          renderedShare,
        )
        await loadVersionOptions(renderedShare.resume_id, { force: true })
        const refreshed = useShareStore.getState()
          .versionOptionsByResumeId[renderedShare.resume_id]
        if (
          deleted
          && refreshed?.loaded
          && !refreshed.error
          && !refreshed.items.some(version => version.id === submittedSelection.versionId)
        ) {
          setSelection(deleted)
          toast.error('所选历史版本已删除，请重新选择')
          return
        }
      }
      toast.error(error instanceof Error ? error.message : '发布失败，请重试')
    }
  }

  return (
    <Dialog
      open={versionDialogOpen}
      onOpenChange={(open) => {
        if (!open && !busy)
          closeVersionDialog()
      }}
    >
      <DialogContent className="min-w-0 max-w-lg">
        <DialogHeader>
          <DialogTitle>更换分享版本</DialogTitle>
          <DialogDescription>
            发布后原链接保持不变，访问者刷新即可看到所选版本。
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-2">
          <VersionSelector
            value={selection}
            versions={versionEntry?.items ?? []}
            loading={versionEntry?.loading ?? false}
            error={versionEntry?.error ?? null}
            disabled={!renderedShare || busy}
            onChange={setSelection}
            onRetry={() => {
              if (renderedShare)
                loadVersionOptions(renderedShare.resume_id, { force: true }).catch(() => undefined)
            }}
          />
          {selection.kind === 'deleted-history' && (
            <p className="rounded-md bg-destructive/8 px-3 py-2 text-sm text-destructive">
              原历史版本已删除，当前链接仍保留发布时的快照。请选择新的版本后再发布。
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            当前简历后续编辑不会自动同步到这个链接。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={closeVersionDialog}>取消</Button>
          <Button
            disabled={!renderedShare || busy || !isPublishableVersionSelection(selection)}
            onClick={handlePublish}
          >
            {busy && <Spinner data-icon="inline-start" />}
            发布所选版本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
