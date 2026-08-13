import type { ResumeCommentThread } from '../types.ts'
import type { CommentUiPermissions } from './types.ts'
import { MessageSquareText } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { COMMENT_MOTION } from '../const.ts'
import { useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { CommentStatusBar } from './comment-status-bar.tsx'
import { isCurrentCommentAuthor } from './types.ts'

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
  permissions,
}: {
  threads: ResumeCommentThread[]
  filter: CommentThreadFilter
  onSelect: (threadId: string) => void
  permissions: CommentUiPermissions
}) {
  const actions = useCommentActions()
  const reduceMotion = useReducedMotion()
  const pendingEntities = useResumeCommentStore(state => state.pendingEntities)
  const mutationErrors = useResumeCommentStore(state => state.mutationErrors)
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
      <AnimatePresence initial={false} mode="popLayout">
        {filtered.map((thread) => {
          const root = thread.comments.find(comment => comment.parentId === null)
          const replies = thread.comments.filter(comment => comment.parentId !== null).length
          const resolveKey = `thread:${thread.id}:resolve`
          const resolving = pendingEntities[resolveKey] === true
          const resolveError = mutationErrors[resolveKey]
          const canResolve = !thread.resolvedAt && (
            permissions.canModerateAll
            || Boolean(root && isCurrentCommentAuthor(root.author, permissions))
          )
          return (
            <motion.div
              key={thread.id}
              layout
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration, ease: COMMENT_MOTION.ease }}
            >
              <Button
                variant="ghost"
                className="group h-auto w-full items-start justify-start whitespace-normal rounded-xl border border-transparent p-3 text-left hover:border-border hover:bg-muted/60"
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
                  <ThreadAuthor thread={thread} />
                  <CommentStatusBar
                    replyCount={replies}
                    canResolve={canResolve}
                    resolving={resolving}
                    error={resolveError}
                    onResolve={() => actions.resolveThread(thread)}
                  />
                </span>
              </Button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
