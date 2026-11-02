import { createDeferredComponent } from '@/components/deferred-content'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader as ModalHeader,
} from '@/components/ui/dialog'
import { useCollaborationPanel } from '../context'

const CollaborationDialogContent = createDeferredComponent(
  () => import('./content/index'),
  '协作设置',
)

export function CollaborationDialog() {
  const {
    collabDialogOpen,
    setCollaborationDialogOpen,
    isSharing,
    participantCount,
  } = useCollaborationPanel()

  return (
    <Dialog open={collabDialogOpen} onOpenChange={setCollaborationDialogOpen}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg'>
        <ModalHeader>
          <DialogTitle>
            {isSharing ? '实时协作已开启' : '开启实时协作'}
          </DialogTitle>
          <DialogDescription>
            {isSharing
              ? `持有链接的人可加入编辑。当前协作人数：${participantCount}`
              : '持有链接的人可共同编辑，修改会实时同步并自动保存。'}
          </DialogDescription>
        </ModalHeader>
        <CollaborationDialogContent />
      </DialogContent>
    </Dialog>
  )
}
