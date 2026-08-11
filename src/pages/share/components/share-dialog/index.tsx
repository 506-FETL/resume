import type { CreateShareOptions, ResumeShareRecord, ResumeShareSnapshotSource } from '@/lib/supabase/resume/share.types'
import { Loader2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useShareStore from '../../store'
import ShareSettingsDialog from '../share-settings-dialog'
import { CreateShareForm } from './create-share-form'
import { ShareLinkRow } from './share-link-row'

export interface ShareSnapshotSource {
  getSnapshot: () => Promise<ResumeShareSnapshotSource>
}

interface ShareDialogProps extends ShareSnapshotSource {}

export default function ShareDialog({ getSnapshot }: ShareDialogProps) {
  const { openForResumeId, openForResumeName, shares, loading, mutatingId, error, closeDialog, create, setActive, updateSettings, pushSnapshot, remove } = useShareStore()
  const navigate = useNavigate()

  const [creating, setCreating] = useState(false)
  const [settingsShare, setSettingsShare] = useState<ResumeShareRecord | null>(null)
  const [deleteShare, setDeleteShare] = useState<ResumeShareRecord | null>(null)
  const open = Boolean(openForResumeId)

  const handleCreate = async (options: CreateShareOptions) => {
    if (!openForResumeId)
      return false
    setCreating(true)
    try {
      const { snapshot, templateManifest, displayName } = await getSnapshot()
      await create(openForResumeId, snapshot, templateManifest, displayName, options)
      toast.success('分享链接已生成')
      return true
    }
    catch {
      toast.error('生成失败，请重试')
      return false
    }
    finally {
      setCreating(false)
    }
  }

  const handlePush = async (shareId: string) => {
    try {
      const { snapshot, templateManifest, displayName } = await getSnapshot()
      await pushSnapshot(shareId, snapshot, templateManifest, displayName)
      toast.success('已推送最新简历到该链接')
    }
    catch {
      toast.error('推送失败')
    }
  }

  const handleToggleActive = async (share: ResumeShareRecord, isActive: boolean) => {
    try {
      await setActive(share.id, isActive)
      toast.success(isActive ? '链接已启用' : '链接已关闭')
    }
    catch {
      toast.error('操作失败')
    }
  }

  const handleSaveSettings = async (settings: {
    label: string | null
    expiresAt: string | null
    password: string | null | undefined
  }) => {
    if (!settingsShare)
      return

    try {
      await updateSettings(settingsShare.id, settings)
      toast.success('分享设置已更新')
      setSettingsShare(null)
    }
    catch {
      toast.error('保存设置失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteShare)
      return

    try {
      await remove(deleteShare.id)
      toast.success('分享链接已永久删除')
      setDeleteShare(null)
    }
    catch {
      toast.error('删除失败')
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSettingsShare(null)
            setDeleteShare(null)
            closeDialog()
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] min-w-0 max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              分享「
              {openForResumeName || '简历'}
              」
            </DialogTitle>
            <DialogDescription>
              生成只读链接，别人无需登录即可查看这份简历的当前快照。你可随时关闭链接或推送最新版。
            </DialogDescription>
          </DialogHeader>

          <CreateShareForm onCreate={handleCreate} />

          <div className="min-w-0 flex flex-col gap-3">
            {(loading || creating) && (
              <div className="flex shrink-0 items-center justify-center py-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!loading && shares.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">还没有分享链接，生成一个吧。</p>
            )}

            <div className="scrollbar-gutter-stable scrollbar-thin-subtle flex min-h-40 max-h-[min(38dvh,22rem)] flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg pr-1">
              <AnimatePresence initial={false} mode="popLayout">
                {shares.map(share => (
                  <ShareLinkRow
                    key={share.id}
                    share={share}
                    busy={mutatingId === share.id}
                    onToggleActive={isActive => handleToggleActive(share, isActive)}
                    onEditSettings={() => setSettingsShare(share)}
                    onPushLatest={() => handlePush(share.id)}
                    onDelete={() => setDeleteShare(share)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
          <Button
            variant="link"
            className="justify-self-end px-0"
            onClick={() => {
              closeDialog()
              navigate('/share')
            }}
          >
            前往分享管理 →
          </Button>
        </DialogContent>
      </Dialog>

      <ShareSettingsDialog
        share={settingsShare}
        busy={Boolean(settingsShare && mutatingId === settingsShare.id)}
        onOpenChange={nextOpen => !nextOpen && setSettingsShare(null)}
        onSave={handleSaveSettings}
      />

      <AlertDialog open={Boolean(deleteShare)} onOpenChange={nextOpen => !nextOpen && setDeleteShare(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除这个分享链接？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，已发出的链接会立即失效，访问次数等统计也无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={Boolean(deleteShare && mutatingId === deleteShare.id)}
            >
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
