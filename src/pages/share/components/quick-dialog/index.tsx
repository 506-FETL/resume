import type { SnapshotProvider } from '../../types'
import type { CreateShareOptions, ShareVersionSelection } from '@/lib/supabase/resume/share.types'
import { X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Spinner } from '@/components/ui/spinner'
import { useIsMobile } from '@/hooks/use-mobile'
import { resolveResumeShareRelease } from '@/lib/supabase/resume/share'
import useShareStore from '../../store'
import ArchiveDialog from '../archive-dialog'
import DeleteDialog from '../delete-dialog'
import SettingsDialog from '../settings-dialog'
import VersionDialog from '../version-dialog'
import { CreateForm } from './create-form'
import { LinkRow } from './link-row'

interface QuickDialogProps {
  getSnapshot: SnapshotProvider
}

export default function QuickDialog({ getSnapshot }: QuickDialogProps) {
  const {
    openForResumeId,
    openForResumeName,
    shares,
    dialogLoading,
    dialogError,
    pendingShareIds,
    closeDialog,
    createRelease,
    loadVersionOptions,
    versionOptionsByResumeId,
  } = useShareStore()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const open = Boolean(openForResumeId)

  const versionEntry = openForResumeId
    ? versionOptionsByResumeId[openForResumeId]
    : undefined

  const handleCreate = async (
    selection: ShareVersionSelection,
    options: CreateShareOptions,
  ) => {
    if (!openForResumeId)
      return false
    try {
      const release = await resolveResumeShareRelease({
        resumeId: openForResumeId,
        displayName: openForResumeName,
        selection,
        getCurrentSource: async () => getSnapshot(),
      })
      await createRelease(openForResumeId, release, options)
      toast.success('分享链接已生成')
      return true
    }
    catch {
      toast.error('生成失败，请重试')
      return false
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen)
      closeDialog()
  }

  const title = (
    <>
      分享「
      {openForResumeName || '简历'}
      」
    </>
  )
  const description = '生成所选版本的只读快照，别人无需登录即可查看。你可随时关闭链接或更换分享版本。'
  const body = (
    <>
      <CreateForm
        versions={versionEntry?.items ?? []}
        versionsLoading={versionEntry?.loading ?? false}
        versionsError={versionEntry?.error ?? null}
        onRetryVersions={() => {
          if (openForResumeId)
            loadVersionOptions(openForResumeId, { force: true }).catch(() => undefined)
        }}
        onCreate={handleCreate}
      />

      <div className="min-w-0 flex flex-col gap-3">
        {dialogLoading && (
          <div className="flex shrink-0 items-center justify-center py-2 text-muted-foreground">
            <Spinner />
          </div>
        )}

        {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}

        {!dialogLoading && shares.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">还没有分享链接，生成一个吧。</p>
        )}

        <div className="scrollbar-gutter-stable scrollbar-thin-subtle flex min-h-40 flex-col gap-2 rounded-lg pr-1 sm:max-h-[min(38dvh,22rem)] sm:overflow-y-auto sm:overscroll-contain">
          <AnimatePresence initial={false} mode="popLayout">
            {shares.map(share => (
              <LinkRow
                key={share.id}
                share={share}
                busy={pendingShareIds.includes(share.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
      <Button
        variant="link"
        className="self-end px-0"
        onClick={() => {
          closeDialog()
          navigate('/share')
        }}
      >
        前往分享管理 →
      </Button>
    </>
  )

  return (
    <>
      {isMobile
        ? (
            <Drawer
              open={open}
              onOpenChange={handleOpenChange}
              modal
              swipeDirection="down"
              showSwipeHandle
            >
              <DrawerContent className="[--drawer-content-height:calc(100dvh-1rem)] [--drawer-content-max-height:calc(100dvh-1rem)]">
                <DrawerHeader className="relative shrink-0 px-6 pt-4 pb-4 text-left">
                  <DrawerTitle className="pr-10 text-lg font-semibold">{title}</DrawerTitle>
                  <DrawerDescription className="pr-10">{description}</DrawerDescription>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="absolute right-4 top-3"
                    aria-label="关闭分享管理"
                    onClick={closeDialog}
                  >
                    <X />
                  </Button>
                </DrawerHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                  {body}
                </div>
              </DrawerContent>
            </Drawer>
          )
        : (
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 max-w-2xl overflow-hidden">
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {body}
              </DialogContent>
            </Dialog>
          )}

      <ArchiveDialog />
      <SettingsDialog />
      <DeleteDialog />
      <VersionDialog getCurrentSnapshot={async () => getSnapshot()} />
    </>
  )
}
