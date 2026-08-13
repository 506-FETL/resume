import type { CommentThreadFilter } from './thread-list.tsx'
import type { CommentUiPermissions } from './types.ts'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { CommentComposer } from './comment-composer.tsx'
import { ThreadDetail } from './thread-detail.tsx'
import { filterCommentThreads, ThreadList } from './thread-list.tsx'

function PanelBody({
  sourceLabel,
  permissions,
  creating,
  onCancelCreating,
}: {
  sourceLabel: string
  permissions: CommentUiPermissions
  creating: boolean
  onCancelCreating: () => void
}) {
  const [filter, setFilter] = useState<CommentThreadFilter>('open')
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
  const activeThread = activeThreadId ? threads.find(thread => thread.id === activeThreadId) : null

  if (activeThread) {
    return (
      <ThreadDetail
        thread={activeThread}
        permissions={permissions}
        onBack={() => setActiveThread(null)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-4 pb-3 pt-4">
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
        </div>
        {accessState !== 'active'
          ? (
              <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {accessState === 'read_only' ? '当前版本已关闭评论，你仍可查看已有内容。' : '当前评论版本已不可用，请刷新页面。'}
              </p>
            )
          : null}
      </header>
      {creating && selection
        ? (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-3 border-l-2 border-amber-300 pl-3 text-sm text-muted-foreground">{selection.exactQuote}</p>
              <CommentComposer
                draftKey="new-thread"
                placeholder="写下你的评论…"
                autoFocus
                disabled={!permissions.canCreate || accessState !== 'active' || actions.pendingAction !== null}
                onCancel={onCancelCreating}
                onSubmit={async value => Boolean(await actions.createThread(value))}
              />
              {actions.errorMessage ? <p className="mt-2 text-xs text-destructive">{actions.errorMessage}</p> : null}
            </div>
          )
        : (
            <>
              <div className="grid grid-cols-3 gap-1 border-b p-2">
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
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ThreadList threads={threads} filter={filter} onSelect={setActiveThread} />
              </div>
            </>
          )}
    </div>
  )
}

export function CommentsPanel({
  open,
  onOpenChange,
  presentation,
  sourceLabel,
  permissions,
  creating,
  onCancelCreating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presentation: 'overlay' | 'docked'
  sourceLabel: string
  permissions: CommentUiPermissions
  creating: boolean
  onCancelCreating: () => void
}) {
  const body = (
    <PanelBody
      sourceLabel={sourceLabel}
      permissions={permissions}
      creating={creating}
      onCancelCreating={onCancelCreating}
    />
  )
  if (presentation === 'docked') {
    return open
      ? (
          <aside
            data-resume-comment-ui
            aria-label="简历评论"
            className="flex h-full w-[400px] shrink-0 flex-col border-l bg-background shadow-xl"
          >
            {body}
          </aside>
        )
      : null
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-resume-comment-ui
        side="right"
        className={cn('w-[400px] max-w-[calc(100vw-16px)] gap-0 p-0 sm:max-w-[400px]')}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>简历评论</SheetTitle>
          <SheetDescription>{sourceLabel}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  )
}
