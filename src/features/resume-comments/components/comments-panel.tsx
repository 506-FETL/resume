import type { CommentThreadFilter } from './thread-list.tsx'
import type { CommentUiPermissions } from './types.ts'
import { Eye, EyeOff, X } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerVirtualKeyboardProvider,
} from '@/components/ui/drawer'
import { useResumeCommentContext, useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { useCommentMobileLayout } from '../hooks/use-comment-mobile-layout.ts'
import { CommentComposer } from './comment-composer.tsx'
import { ThreadDetail } from './thread-detail.tsx'
import { filterCommentThreads, ThreadList } from './thread-list.tsx'

function PanelBody({
  sourceLabel,
  permissions,
  creating,
  onCancelCreating,
  onClose,
  onBeginRelink,
}: {
  sourceLabel: string
  permissions: CommentUiPermissions
  creating: boolean
  onCancelCreating: () => void
  onClose: () => void
  onBeginRelink: (threadId: string) => void
}) {
  const [filter, setFilter] = useState<CommentThreadFilter>('open')
  const { panelHeaderContent } = useResumeCommentContext()
  const actions = useCommentActions()
  const threads = useResumeCommentStore(useShallow(
    state => state.orderedThreadIds.map(id => state.threadsById[id]).filter(Boolean),
  ))
  const activeThreadId = useResumeCommentStore(state => state.activeThreadId)
  const setActiveThread = useResumeCommentStore(state => state.setActiveThread)
  const selection = useResumeCommentStore(state => state.selection)
  const hidden = useResumeCommentStore(state => state.highlightsHidden)
  const setHidden = useResumeCommentStore(state => state.setHighlightsHidden)
  const lastEventSeq = useResumeCommentStore(state => state.lastEventSeq)
  const lastReadEventSeq = useResumeCommentStore(state => state.lastReadEventSeq)
  const accessState = useResumeCommentStore(state => state.accessState)
  const contentNotice = useResumeCommentStore(state => state.contentNotice)
  const setContentNotice = useResumeCommentStore(state => state.setContentNotice)
  const activeThread = activeThreadId ? threads.find(thread => thread.id === activeThreadId) : null

  if (activeThread) {
    return (
      <ThreadDetail
        thread={activeThread}
        permissions={permissions}
        onBack={() => setActiveThread(null)}
        onBeginRelink={onBeginRelink}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 pr-8">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">评论</h2>
            <p className="truncate text-xs text-muted-foreground">{sourceLabel}</p>
          </div>
          {lastEventSeq > lastReadEventSeq ? <Badge>有新评论</Badge> : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={hidden ? '显示评论高亮' : '隐藏评论高亮'}
            onClick={() => setHidden(!hidden)}
          >
            {hidden ? <Eye /> : <EyeOff />}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="关闭评论" onClick={onClose}>
            <X />
          </Button>
        </div>
        {accessState !== 'active'
          ? (
              <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {accessState === 'read_only' ? '当前评论仅可查看，不能新增或回复。' : '当前评论版本已不可用，请刷新页面。'}
              </p>
            )
          : null}
        {contentNotice
          ? (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="flex-1">{contentNotice}</p>
                <Button size="xs" variant="ghost" onClick={() => setContentNotice(null)}>知道了</Button>
              </div>
            )
          : null}
        {panelHeaderContent}
      </header>
      {creating && selection
        ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-3 border-l-2 border-amber-300 pl-3 text-sm text-muted-foreground">{selection.exactQuote}</p>
              <CommentComposer
                draftKey="new-thread"
                placeholder="写下你的评论…"
                autoFocus
                disabled={!permissions.canCreate || accessState !== 'active' || actions.pendingAction !== null}
                pending={actions.pendingAction === 'thread:new:create'}
                pendingLabel="正在发送…"
                onCancel={onCancelCreating}
                onSubmit={async value => Boolean(await actions.createThread(value))}
              />
              {actions.errorMessage ? <p className="mt-2 text-xs text-destructive">{actions.errorMessage}</p> : null}
            </div>
          )
        : (
            <>
              <div className="grid shrink-0 grid-cols-3 gap-1 border-b p-2">
                {([
                  ['open', '未解决'],
                  ['resolved', '已解决'],
                  ['detached', '失去锚点'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? 'secondary' : 'ghost'}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                    <span className="text-xs text-muted-foreground">{filterCommentThreads(threads, value).length}</span>
                  </Button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 overflow-y-auto">
                <ThreadList
                  threads={threads}
                  filter={filter}
                  permissions={permissions}
                  onSelect={setActiveThread}
                />
              </div>
            </>
          )}
    </div>
  )
}

export function CommentsPanel({
  open,
  onOpenChange,
  sourceLabel,
  permissions,
  creating,
  onCancelCreating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceLabel: string
  permissions: CommentUiPermissions
  creating: boolean
  onCancelCreating: () => void
}) {
  const isMobile = useCommentMobileLayout()
  const beginRelink = useResumeCommentStore(state => state.beginRelink)
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
  }
  const body = (
    <PanelBody
      sourceLabel={sourceLabel}
      permissions={permissions}
      creating={creating}
      onCancelCreating={onCancelCreating}
      onClose={() => handleOpenChange(false)}
      onBeginRelink={(threadId) => {
        beginRelink(threadId)
        if (isMobile)
          handleOpenChange(false)
      }}
    />
  )
  const content = (
    <DrawerContent
      data-resume-comment-ui
      aria-label="简历评论"
      overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      className={isMobile
        ? 'pb-[env(safe-area-inset-bottom)] [--drawer-content-height:60vh] [--drawer-content-max-height:60vh]'
        : '[--drawer-content-width:min(400px,calc(100vw-1rem))]'}
    >
      <DrawerTitle className="sr-only">简历评论</DrawerTitle>
      <DrawerDescription className="sr-only">{sourceLabel}</DrawerDescription>
      {body}
    </DrawerContent>
  )
  if (isMobile) {
    return (
      <Drawer
        key="resume-comments-mobile"
        open={open}
        onOpenChange={handleOpenChange}
        modal
        swipeDirection="down"
        showSwipeHandle
      >
        <DrawerVirtualKeyboardProvider>
          {content}
        </DrawerVirtualKeyboardProvider>
      </Drawer>
    )
  }
  return (
    <Drawer
      key="resume-comments-desktop"
      open={open}
      onOpenChange={handleOpenChange}
      modal
      swipeDirection="right"
    >
      {content}
    </Drawer>
  )
}
