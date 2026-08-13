import type { ReactNode } from 'react'
import type { ResumeComment, ResumeCommentThread } from '../types.ts'
import type { CommentUiPermissions } from './types.ts'
import { ArrowLeft, Link2, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useResumeCommentClient, useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { CommentComposer } from './comment-composer.tsx'
import { isCurrentCommentAuthor } from './types.ts'

function formatTime(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
    : ''
}

function CommentBody({ body }: { body: string }) {
  const parts = useMemo(() => {
    const result: Array<{ key: number, text: string, link: boolean }> = []
    const pattern = /https?:\/\/\S+|mailto:\S+/giu
    let cursor = 0
    for (const match of body.matchAll(pattern)) {
      const index = match.index
      if (index > cursor)
        result.push({ key: cursor, text: body.slice(cursor, index), link: false })
      result.push({ key: index, text: match[0], link: true })
      cursor = index + match[0].length
    }
    if (cursor < body.length)
      result.push({ key: cursor, text: body.slice(cursor), link: false })
    return result
  }, [body])
  return (
    <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6">
      {parts.map((part) => {
        if (!part.link)
          return <span key={part.key}>{part.text}</span>
        try {
          const url = new URL(part.text)
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol))
            return <span key={part.key}>{part.text}</span>
          return (
            <a
              key={part.key}
              href={url.href}
              target={url.protocol === 'mailto:' ? undefined : '_blank'}
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2"
            >
              {part.text}
            </a>
          )
        }
        catch {
          return <span key={part.key}>{part.text}</span>
        }
      })}
    </p>
  )
}

function AuthorAvatar({ comment }: { comment: ResumeComment }) {
  const image = comment.author.kind === 'user' ? comment.author.avatarUrl : null
  return (
    <Avatar className="size-8">
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{comment.author.displayName.slice(0, 1)}</AvatarFallback>
    </Avatar>
  )
}

function CommentItem({
  comment,
  thread,
  permissions,
  actions,
}: {
  comment: ResumeComment
  thread: ResumeCommentThread
  permissions: CommentUiPermissions
  actions: ReturnType<typeof useCommentActions>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const canManage = !comment.deletedAt && isCurrentCommentAuthor(comment.author, permissions)
  return (
    <article className="flex gap-3 py-3">
      <AuthorAvatar comment={comment} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{comment.author.displayName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
          {comment.editedAt ? <span className="text-xs text-muted-foreground">已编辑</span> : null}
          {canManage
            ? (
                <div className="ml-auto flex items-center gap-1">
                  {confirmingDelete
                    ? (
                        <>
                          <Button size="xs" variant="destructive" onClick={() => actions.deleteComment(thread, comment.id)}>确认删除</Button>
                          <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>取消</Button>
                        </>
                      )
                    : (
                        <>
                          <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>编辑</Button>
                          <Button size="icon-xs" variant="ghost" aria-label="删除评论" onClick={() => setConfirmingDelete(true)}>
                            <Trash2 />
                          </Button>
                        </>
                      )}
                </div>
              )
            : null}
        </div>
        {editing
          ? (
              <div className="mt-2">
                <CommentComposer
                  draftKey={`edit:${comment.id}`}
                  initialValue={comment.body}
                  submitLabel="保存"
                  disabled={actions.pendingAction !== null}
                  onCancel={() => setEditing(false)}
                  onSubmit={async (value) => {
                    const response = await actions.editComment(thread, comment.id, value)
                    if (response)
                      setEditing(false)
                    return Boolean(response)
                  }}
                />
              </div>
            )
          : comment.deletedAt
            ? <p className="mt-1 text-sm italic text-muted-foreground">原评论已删除</p>
            : <div className="mt-1"><CommentBody body={comment.body} /></div>}
      </div>
    </article>
  )
}

export function ThreadDetail({
  thread,
  permissions,
  onBack,
  footer,
}: {
  thread: ResumeCommentThread
  permissions: CommentUiPermissions
  onBack: () => void
  footer?: ReactNode
}) {
  const actions = useCommentActions()
  const [confirmingThreadDelete, setConfirmingThreadDelete] = useState(false)
  const client = useResumeCommentClient()
  const selection = useResumeCommentStore(state => state.selection)
  const accessState = useResumeCommentStore(state => state.accessState)
  const root = thread.comments.find(comment => comment.parentId === null)
  const replies = thread.comments.filter(comment => comment.parentId !== null)
  const access = client.getAccessContext()
  const effectivePermissions = {
    ...permissions,
    currentAnonymousId: permissions.currentAnonymousId
      ?? (access.kind === 'share' ? access.anonymous?.id : null),
  }
  const canResolve = permissions.canModerateAll
    || Boolean(root && isCurrentCommentAuthor(root.author, effectivePermissions))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button size="icon-sm" variant="ghost" aria-label="返回评论列表" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate border-l-2 border-amber-300 pl-2 text-xs text-muted-foreground">
            {thread.anchor.exactQuote}
          </p>
        </div>
        {canResolve && !thread.resolvedAt
          ? <Button size="sm" variant="ghost" onClick={() => actions.resolveThread(thread)}>解决</Button>
          : null}
        {canResolve && thread.resolvedAt
          ? (
              <Button size="sm" variant="ghost" onClick={() => actions.reopenThread(thread)}>
                <RotateCcw />
                重开
              </Button>
            )
          : null}
        {permissions.canModerateAll
          ? confirmingThreadDelete
            ? (
                <div className="flex items-center gap-1">
                  <Button size="xs" variant="destructive" onClick={() => actions.deleteThread(thread).then(response => response && onBack())}>确认删除</Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirmingThreadDelete(false)}>取消</Button>
                </div>
              )
            : (
                <Button size="icon-sm" variant="ghost" aria-label="线程菜单" onClick={() => setConfirmingThreadDelete(true)}>
                  <MoreHorizontal />
                </Button>
              )
          : null}
      </header>
      {thread.anchorStatus === 'detached'
        ? (
            <div className="m-3 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>原文字已变化，这条评论暂时无法定位。</p>
              {canResolve && selection
                ? (
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => actions.relinkThread(thread)}>
                      <Link2 />
                      关联到当前选区
                    </Button>
                  )
                : null}
            </div>
          )
        : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {root ? <CommentItem comment={root} thread={thread} permissions={effectivePermissions} actions={actions} /> : null}
        {replies.length > 0 ? <Separator /> : null}
        {replies.map(comment => (
          <CommentItem key={comment.id} comment={comment} thread={thread} permissions={effectivePermissions} actions={actions} />
        ))}
      </div>
      {actions.errorMessage
        ? <p role="alert" className="px-4 py-2 text-xs text-destructive">{actions.errorMessage}</p>
        : null}
      {permissions.canCreate && accessState === 'active' && !thread.resolvedAt
        ? (
            <div className="border-t p-3">
              <CommentComposer
                draftKey={`reply:${thread.id}`}
                placeholder="回复…"
                disabled={actions.pendingAction !== null}
                onSubmit={async value => Boolean(await actions.createReply(thread, value))}
              />
            </div>
          )
        : null}
      {footer}
    </div>
  )
}
