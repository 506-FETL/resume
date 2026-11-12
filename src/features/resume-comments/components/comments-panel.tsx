import type { PendingCommentCreationSnapshot } from '../store/types.ts'
import type { CommentUiPermissions } from './types.ts'
import { createDeferredComponent } from '@/components/deferred-content'
import { ContentSkeleton } from '@/components/loading-skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerVirtualKeyboardProvider,
} from '@/components/ui/drawer'
import { useResumeCommentStore } from '../context.tsx'
import { useCommentMobileLayout } from '../hooks/use-comment-mobile-layout.ts'

const PanelBody = createDeferredComponent(
  () => import('./comments-panel-content.tsx'),
  '评论面板',
  <ContentSkeleton label='正在加载评论面板' />,
)

export function CommentsPanel({
  open,
  onOpenChange,
  sourceLabel,
  permissions,
  creationSnapshot,
  onCancelCreating,
  onFinishCreating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceLabel: string
  permissions: CommentUiPermissions
  creationSnapshot: PendingCommentCreationSnapshot | null
  onCancelCreating: () => void
  onFinishCreating: () => void
}) {
  const isMobile = useCommentMobileLayout()
  const beginRelink = useResumeCommentStore((state) => state.beginRelink)

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }

  const body = (
    <PanelBody
      sourceLabel={sourceLabel}
      permissions={permissions}
      creationSnapshot={creationSnapshot}
      onCancelCreating={onCancelCreating}
      onFinishCreating={onFinishCreating}
      keyboardAwareReply={isMobile}
      onBeginRelink={(threadId) => {
        beginRelink(threadId)
        handleOpenChange(false)
      }}
    />
  )

  const content = (
    <DrawerContent
      data-resume-comment-ui
      aria-label='简历评论'
      finalFocus={() =>
        document.querySelector<HTMLButtonElement>(
          '[data-resume-comment-trigger]',
        ) ?? true
      }
      overlayClassName='supports-backdrop-filter:backdrop-blur-none'
      className={
        isMobile
          ? undefined
          : '[--drawer-content-width:min(400px,calc(100vw-1rem))]'
      }
    >
      <DrawerTitle className='sr-only'>简历评论</DrawerTitle>
      <DrawerDescription className='sr-only'>{sourceLabel}</DrawerDescription>
      {body}
    </DrawerContent>
  )

  if (isMobile) {
    return (
      <Drawer
        key='resume-comments-mobile'
        open={open}
        onOpenChange={handleOpenChange}
        modal
        swipeDirection='down'
      >
        <DrawerVirtualKeyboardProvider>{content}</DrawerVirtualKeyboardProvider>
      </Drawer>
    )
  }

  return (
    <Drawer
      key='resume-comments-desktop'
      open={open}
      onOpenChange={handleOpenChange}
      modal
      swipeDirection='right'
    >
      {content}
    </Drawer>
  )
}
