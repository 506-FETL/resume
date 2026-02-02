import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogHeader as ModalHeader,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCollaborationPanel } from './CollaborationPanelProvider'

export function CollaborationDialog() {
  const {
    collabDialogOpen,
    setCollaborationDialogOpen,
    closeCollaborationDialog,
    isSharing,
    participantCount,
    shareUrl,
    onCopyShareLink,
    collaborationRole,
    onStopSharing,
    collaborationError,
    onStartSharing,
    canStartSharing,
    isCollabConnecting,
  } = useCollaborationPanel()

  return (
    <Dialog open={collabDialogOpen} onOpenChange={setCollaborationDialogOpen}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        {isSharing
          ? (
              <SharingContent
                participantCount={participantCount}
                shareUrl={shareUrl}
                onCopyShareLink={onCopyShareLink}
                collaborationRole={collaborationRole}
                onStopSharing={onStopSharing}
                onClose={closeCollaborationDialog}
              />
            )
          : (
              <StartSharingContent
                collaborationError={collaborationError}
                onStartSharing={onStartSharing}
                canStartSharing={canStartSharing}
                isCollabConnecting={isCollabConnecting}
                onClose={closeCollaborationDialog}
              />
            )}
      </DialogContent>
    </Dialog>
  )
}

function SharingContent({
  participantCount,
  shareUrl,
  onCopyShareLink,
  collaborationRole,
  onStopSharing,
  onClose,
}: {
  participantCount: number
  shareUrl: string | null
  onCopyShareLink: () => void
  collaborationRole: 'host' | 'guest' | null
  onStopSharing: () => void
  onClose: () => void
}) {
  return (
    <>
      <ModalHeader>
        <DialogTitle>实时协作已开启</DialogTitle>
        <DialogDescription>
          将链接分享给队友即可实时同步编辑内容，当前协作人数
          {participantCount}
        </DialogDescription>
      </ModalHeader>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">分享链接</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl ?? ''} className="flex-1 text-xs md:text-sm" />
            <Button type="button" size="sm" variant="outline" onClick={onCopyShareLink} disabled={!shareUrl}>
              <Copy className="h-4 w-4" />
              <span className="hidden md:inline">复制</span>
            </Button>
          </div>
        </div>
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{collaborationRole === 'host' ? '发起者' : '协作者'}</span>
            {collaborationRole === 'host'
              ? ' 可以随时关闭共享，关闭后他人将无法继续加入此链接。'
              : ' 可以随时退出协作，重新访问链接即可再次加入。'}
          </p>
        </div>
      </div>
      <DialogFooter className="flex justify-between sm:justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          关闭
        </Button>
        <Button type="button" variant="destructive" onClick={onStopSharing}>
          {collaborationRole === 'host' ? '停止共享' : '离开协作'}
        </Button>
      </DialogFooter>
    </>
  )
}

function StartSharingContent({
  collaborationError,
  onStartSharing,
  canStartSharing,
  isCollabConnecting,
  onClose,
}: {
  collaborationError: string | null
  onStartSharing: () => void | Promise<void>
  canStartSharing: boolean
  isCollabConnecting: boolean
  onClose: () => void
}) {
  return (
    <>
      <ModalHeader>
        <DialogTitle>开启实时协作</DialogTitle>
        <DialogDescription>启用后将创建协作会话，你可以复制链接分享给队友，大家的更改会实时同步。</DialogDescription>
      </ModalHeader>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>• 支持多人同时编辑，自动保存修改记录</p>
        <p>• 分享结束后链接立即失效，可随时重新开启</p>
      </div>
      {collaborationError && <p className="text-sm text-destructive">{collaborationError}</p>}
      <DialogFooter className="flex justify-between sm:justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="button" onClick={onStartSharing} disabled={!canStartSharing}>
          {isCollabConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          确认开启
        </Button>
      </DialogFooter>
    </>
  )
}
