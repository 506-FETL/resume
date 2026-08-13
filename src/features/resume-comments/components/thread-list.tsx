import type { ResumeCommentThread } from '../types.ts'
import { MessageSquareText } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/* eslint-disable react-refresh/only-export-components */

export type CommentThreadFilter = 'open' | 'resolved' | 'detached'

export function filterCommentThreads(
  threads: ResumeCommentThread[],
  filter: CommentThreadFilter,
) {
  if (filter === 'detached')
    return threads.filter(thread => thread.anchorStatus === 'detached')
  if (filter === 'resolved')
    return threads.filter(thread => Boolean(thread.resolvedAt) && thread.anchorStatus !== 'detached')
  return threads.filter(thread => !thread.resolvedAt && thread.anchorStatus === 'anchored')
}

function formatActivity(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp))
    return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function ThreadAuthor({ thread }: { thread: ResumeCommentThread }) {
  const author = thread.comments.find(comment => comment.parentId === null)?.author
  const image = author?.kind === 'user' ? author.avatarUrl : null
  const name = author?.displayName ?? '已删除用户'
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="size-5">
        {image ? <AvatarImage src={image} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
      <span aria-hidden="true">·</span>
      <span className="shrink-0">{formatActivity(thread.lastActivityAt)}</span>
    </div>
  )
}

export function ThreadList({
  threads,
  filter,
  onSelect,
}: {
  threads: ResumeCommentThread[]
  filter: CommentThreadFilter
  onSelect: (threadId: string) => void
}) {
  const filtered = filterCommentThreads(threads, filter)
  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
        <MessageSquareText className="size-8 opacity-45" />
        <p>{filter === 'open' ? '还没有未解决的评论' : filter === 'resolved' ? '还没有已解决的评论' : '没有失去锚点的评论'}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2 p-3">
      {filtered.map((thread) => {
        const root = thread.comments.find(comment => comment.parentId === null)
        const replies = thread.comments.filter(comment => comment.parentId !== null).length
        return (
          <Button
            key={thread.id}
            variant="ghost"
            className="h-auto w-full items-start justify-start whitespace-normal rounded-xl border border-transparent p-3 text-left hover:border-border hover:bg-muted/60"
            onClick={() => onSelect(thread.id)}
          >
            <span className="min-w-0 flex-1 space-y-2">
              <span className="flex items-start gap-2">
                <span className="line-clamp-2 flex-1 border-l-2 border-amber-300 pl-2 text-xs text-muted-foreground">
                  {thread.anchor.exactQuote}
                </span>
                {thread.anchorStatus === 'detached' ? <Badge variant="outline">已失联</Badge> : null}
              </span>
              <span className="line-clamp-3 block text-sm text-foreground">
                {root?.deletedAt ? '原评论已删除' : root?.body || '空评论'}
              </span>
              <span className="flex items-center justify-between gap-2">
                <ThreadAuthor thread={thread} />
                {replies > 0
                  ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {replies}
                        {' '}
                        条回复
                      </span>
                    )
                  : null}
              </span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}
