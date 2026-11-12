import { useJobContextStore } from '@/lib/job-context'
import type { SnapshotProvider } from '../../types'
import type {
  CreateShareOptions,
  ShareVersionSelection,
} from '@/lib/supabase/resume/share.types'
import { memo, useId, useLayoutEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { createDeferredComponent } from '@/components/deferred-content'
import { ContentSkeleton } from '@/components/loading-skeleton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { resolveResumeShareRelease } from '@/lib/supabase/resume/share'
import useShareStore from '../../store'
import ArchiveDialog from '../archive-dialog'
import DeleteDialog from '../delete-dialog'
import SettingsDialog from '../settings-dialog'
import VersionDialog from '../version-dialog'
import ShareDrawer from '../share-drawer'

const QuickDialogContent = createDeferredComponent(
  () => import('./content'),
  '分享面板',
  <ContentSkeleton label='正在加载分享面板' />,
)

interface QuickDialogProps {
  getSnapshot: SnapshotProvider
}

function QuickDialog({ getSnapshot }: QuickDialogProps) {
  const {
    ownerUserId,
    openForResumeId,
    openForResumeName,
    shares,
    dialogLoading,
    dialogError,
    pendingShareIds,
    closeDialog,
    createRelease,
    loadVersionOptions,
    loadDialogShares,
    versionOptionsByResumeId,
  } = useShareStore()

  const navigate = useNavigate()
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [contentReady, setContentReady] = useState(false)

  const open = Boolean(openForResumeId)

  const versionEntry = openForResumeId
    ? versionOptionsByResumeId[openForResumeId]
    : undefined

  const currentDisplay = useMemo(
    () => ({
      ownerUserId,
      resumeId: openForResumeId,
      resumeName: openForResumeName,
      shares,
      loading: dialogLoading,
      error: dialogError,
      versionEntry,
    }),
    [
      ownerUserId,
      openForResumeId,
      openForResumeName,
      shares,
      dialogLoading,
      dialogError,
      versionEntry,
    ],
  )

  const [retainedDisplay, setRetainedDisplay] = useState<
    typeof currentDisplay | null
  >(null)

  useLayoutEffect(() => {
    if (open) setRetainedDisplay(currentDisplay)
  }, [currentDisplay, open])

  // store 关窗时清空列表，退出画面保留到抽屉卸载；切换账户立即失效。
  const display = open
    ? currentDisplay
    : retainedDisplay?.ownerUserId === ownerUserId
      ? retainedDisplay
      : null

  const handleCreate = async (
    selection: ShareVersionSelection,
    options: CreateShareOptions,
  ) => {
    if (!openForResumeId) return false

    try {
      const release = await resolveResumeShareRelease({
        resumeId: openForResumeId,
        displayName: openForResumeName,
        selection,
        getCurrentSource: async () => getSnapshot(),
      })

      const job = useJobContextStore.getState().context

      await createRelease(openForResumeId, release, {
        ...options,
        jobId: job?.resumeId === openForResumeId ? job.id : undefined,
      })

      toast.success('分享链接已生成')

      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '生成失败，请重试')

      return false
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) closeDialog()
  }

  return (
    <>
      <ShareDrawer
        open={open}
        busy={submitting}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={(nextOpen) => {
          if (!nextOpen) setRetainedDisplay(null)
        }}
        title={`分享「${display?.resumeName || '简历'}」`}
        description='生成新链接，或在下方管理这份简历已有的链接。'
        footer={
          <>
            <Button
              type='button'
              variant='ghost'
              className='mr-auto px-2'
              disabled={submitting}
              onClick={() => {
                closeDialog()
                navigate('/share')
              }}
            >
              分享管理 →
            </Button>
            <Button
              type='submit'
              form={formId}
              disabled={submitting || !contentReady}
            >
              {submitting ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <Plus data-icon='inline-start' />
              )}
              {submitting ? '正在生成…' : '生成分享链接'}
            </Button>
          </>
        }
      >
        <QuickDialogContent
          display={display}
          formId={formId}
          submitting={submitting}
          setSubmitting={setSubmitting}
          pendingShareIds={pendingShareIds}
          onReadyChange={setContentReady}
          onCreate={handleCreate}
          onRetryVersions={() => {
            if (openForResumeId)
              loadVersionOptions(openForResumeId, { force: true }).catch(
                () => undefined,
              )
          }}
          onRetryShares={() => {
            if (openForResumeId) loadDialogShares(openForResumeId)
          }}
        />
      </ShareDrawer>
      <ArchiveDialog />
      <SettingsDialog />
      <DeleteDialog />
      <VersionDialog getCurrentSnapshot={async () => getSnapshot()} />
    </>
  )
}

export default memo(QuickDialog)
