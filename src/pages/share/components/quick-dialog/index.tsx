import { useJobContextStore } from '@/lib/job-context'
import type { SnapshotProvider } from '../../types'
import type {
  CreateShareOptions,
  ShareVersionSelection,
} from '@/lib/supabase/resume/share.types'
import { memo, useId, useLayoutEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AnimatedContent from '@/components/motion/animated-content'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { resolveResumeShareRelease } from '@/lib/supabase/resume/share'
import useShareStore from '../../store'
import ArchiveDialog from '../archive-dialog'
import DeleteDialog from '../delete-dialog'
import SettingsDialog from '../settings-dialog'
import VersionDialog from '../version-dialog'
import { CreateForm } from './create-form'
import { LinkRow } from './link-row'
import ShareDrawer from '../share-drawer'

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
            <Button type='submit' form={formId} disabled={submitting}>
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
        <div className='space-y-6'>
          <CreateForm
            key={display?.resumeId}
            formId={formId}
            submitting={submitting}
            onSubmittingChange={setSubmitting}
            versions={display?.versionEntry?.items ?? []}
            versionsLoading={display?.versionEntry?.loading ?? false}
            versionsError={display?.versionEntry?.error ?? null}
            onRetryVersions={() => {
              if (openForResumeId)
                loadVersionOptions(openForResumeId, { force: true }).catch(
                  () => undefined,
                )
            }}
            onCreate={handleCreate}
          />
          <section
            className='min-w-0 space-y-3 border-t pt-5'
            aria-labelledby={`${formId}-links-heading`}
          >
            <div className='flex items-center justify-between gap-2'>
              <h3
                id={`${formId}-links-heading`}
                className='text-sm font-medium'
              >
                已有链接
              </h3>
              {!display?.loading && !display?.error && (
                <span className='text-xs tabular-nums text-muted-foreground'>
                  {display?.shares.length ?? 0} 个
                </span>
              )}
            </div>
            <AnimatedContent
              animationKey={
                display?.loading
                  ? 'loading'
                  : display?.error
                    ? 'error'
                    : display?.shares.length === 0
                      ? 'empty'
                      : 'ready'
              }
              className='empty:hidden'
            >
              {display?.loading ? (
                <div
                  role='status'
                  className='flex items-center gap-2 py-3 text-sm text-muted-foreground'
                >
                  <Spinner />
                  正在加载分享链接…
                </div>
              ) : display?.error ? (
                <div
                  role='alert'
                  className='flex items-center justify-between gap-3 py-2'
                >
                  <p className='min-w-0 text-sm text-destructive'>
                    {display.error}
                  </p>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      if (openForResumeId) loadDialogShares(openForResumeId)
                    }}
                  >
                    <RefreshCcw data-icon='inline-start' />
                    重试
                  </Button>
                </div>
              ) : display?.shares.length === 0 ? (
                <p className='py-3 text-sm text-muted-foreground'>
                  还没有分享链接，生成后会显示在这里。
                </p>
              ) : null}
            </AnimatedContent>
            <div className='min-w-0 divide-y divide-border'>
              <AnimatePresence initial={false} mode='popLayout'>
                {display?.shares.map((share) => (
                  <LinkRow
                    key={share.id}
                    share={share}
                    busy={pendingShareIds.includes(share.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </ShareDrawer>
      <ArchiveDialog />
      <SettingsDialog />
      <DeleteDialog />
      <VersionDialog getCurrentSnapshot={async () => getSnapshot()} />
    </>
  )
}

export default memo(QuickDialog)
