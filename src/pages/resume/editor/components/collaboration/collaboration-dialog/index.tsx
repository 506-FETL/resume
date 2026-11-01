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
import { useCollaborationPanel } from '../context'

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
    collaborationConnectionPhase,
    collaborationConnectionLabel,
  } = useCollaborationPanel()

  return (
    <Dialog open={collabDialogOpen} onOpenChange={setCollaborationDialogOpen}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg'>
        {isSharing ? (
          <SharingContent
            participantCount={participantCount}
            shareUrl={shareUrl}
            onCopyShareLink={onCopyShareLink}
            collaborationRole={collaborationRole}
            onStopSharing={onStopSharing}
            onClose={closeCollaborationDialog}
            isStopping={collaborationConnectionPhase === 'stopping'}
          />
        ) : (
          <StartSharingContent
            collaborationError={collaborationError}
            onStartSharing={onStartSharing}
            canStartSharing={canStartSharing}
            isCollabConnecting={isCollabConnecting}
            collaborationConnectionLabel={collaborationConnectionLabel}
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
  isStopping,
}: {
  participantCount: number
  shareUrl: string | null
  onCopyShareLink: () => void
  collaborationRole: 'host' | 'guest' | null
  onStopSharing: () => Promise<void>
  onClose: () => void
  isStopping: boolean
}) {
  return (
    <>
      <ModalHeader>
        <DialogTitle>实时协作已开启</DialogTitle>
        <DialogDescription>
          持有链接的人可加入编辑。当前协作人数：
          {participantCount}
        </DialogDescription>
      </ModalHeader>
      <div className='space-y-6'>
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>分享链接</p>
          <div className='flex items-center gap-2'>
            <Input
              readOnly
              value={shareUrl ?? ''}
              className='flex-1 text-xs md:text-sm'
            />
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={onCopyShareLink}
              disabled={!shareUrl}
            >
              <Copy className='size-4' />
              <span className='hidden md:inline'>复制</span>
            </Button>
          </div>
        </div>
        <div className='rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
          <p>
            <span className='font-medium text-foreground'>
              {collaborationRole === 'host' ? '发起者' : '协作者'}
            </span>
            {collaborationRole === 'host'
              ? ' 关闭共享后，他人无法再通过此链接加入。'
              : ' 退出后可通过此链接重新加入。'}
          </p>
        </div>
      </div>
      <DialogFooter className='flex justify-between sm:justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={onClose}
          disabled={isStopping}
        >
          关闭
        </Button>
        <Button
          type='button'
          variant='destructive'
          onClick={() => onStopSharing().catch(() => undefined)}
          disabled={isStopping}
        >
          {isStopping && <Loader2 className='mr-2 size-4 animate-spin' />}
          {isStopping
            ? '正在停止共享'
            : collaborationRole === 'host'
              ? '停止共享'
              : '离开协作'}
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
  collaborationConnectionLabel,
  onClose,
}: {
  collaborationError: string | null
  onStartSharing: () => void | Promise<void>
  canStartSharing: boolean
  isCollabConnecting: boolean
  collaborationConnectionLabel: string | null
  onClose: () => void
}) {
  return (
    <>
      <ModalHeader>
        <DialogTitle>开启实时协作</DialogTitle>
        <DialogDescription>
          持有链接的人可共同编辑，修改会实时同步并自动保存。
        </DialogDescription>
      </ModalHeader>
      <p className='text-sm text-muted-foreground'>
        停止共享后链接立即失效，可重新开启。
      </p>
      {collaborationError && (
        <p className='text-sm text-destructive'>{collaborationError}</p>
      )}
      <DialogFooter className='flex justify-between sm:justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={onClose}
          disabled={isCollabConnecting}
        >
          取消
        </Button>
        <Button
          type='button'
          onClick={onStartSharing}
          disabled={!canStartSharing}
        >
          {isCollabConnecting && (
            <Loader2 className='mr-2 size-4 animate-spin' />
          )}
          {collaborationConnectionLabel ?? '确认开启'}
        </Button>
      </DialogFooter>
    </>
  )
}
