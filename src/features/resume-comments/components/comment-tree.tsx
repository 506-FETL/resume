import type { ResumeComment, ResumeCommentThread } from '../types.ts'
import type { CommentUiPermissions } from './types.ts'
import { ArrowLeft, LoaderCircle, MessageCircle, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { COMMENT_MOTION } from '../const.ts'
import { useResumeCommentStore } from '../context.tsx'
import { useCommentActions } from '../hooks/use-comment-actions.ts'
import { CommentComposer } from './comment-composer.tsx'
import { isCurrentCommentAuthor } from './types.ts'

interface CommentTreeNode {
  comment: ResumeComment
  children: CommentTreeNode[]
}

export interface CommentReplyTarget {
  commentId: string
  displayName: string
}

function buildCommentTree(comments: ResumeComment[]) {
  const nodes = new Map<string, CommentTreeNode>(
    comments.map(comment => [comment.id, { comment, children: [] }]),
  )
  const roots: CommentTreeNode[] = []
  for (const comment of comments) {
    const node = nodes.get(comment.id)!
    const parent = comment.parentId ? nodes.get(comment.parentId) : null
    if (parent)
      parent.children.push(node)
    else
      roots.push(node)
  }
  return { nodes, roots }
}

function countDescendants(node: CommentTreeNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0)
}

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

function CommentNode({
  node,
  depth,
  thread,
  permissions,
  actions,
  onReply,
  onOpenReplies,
  isLast = true,
}: {
  node: CommentTreeNode
  depth: number
  thread: ResumeCommentThread
  permissions: CommentUiPermissions
  actions: ReturnType<typeof useCommentActions>
  onReply: (target: CommentReplyTarget) => void
  onOpenReplies: (commentId: string) => void
  isLast?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const comment = node.comment
  const canManage = !comment.deletedAt && isCurrentCommentAuthor(comment.author, permissions)
  const editKey = `comment:${comment.id}:edit`
  const deleteKey = `comment:${comment.id}:delete`
  const pending = useResumeCommentStore(state => Boolean(state.pendingEntities[editKey] || state.pendingEntities[deleteKey]))
  const error = useResumeCommentStore(state => state.mutationErrors[editKey] ?? state.mutationErrors[deleteKey])
  const image = comment.author.kind === 'user' ? comment.author.avatarUrl : null
  const visibleChildren = depth < 2 ? node.children : []
  const hiddenReplyCount = depth >= 2 ? countDescendants(node) : 0
  const hasVisibleContinuation = visibleChildren.length > 0 || hiddenReplyCount > 0

  return (
    <motion.div
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 7, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4, scale: 0.985 }}
      transition={{ duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration, ease: COMMENT_MOTION.ease }}
      className={cn('relative w-full min-w-0', depth > 0 && 'pl-7')}
    >
      {depth > 0
        ? (
            <>
              <span aria-hidden className="pointer-events-none absolute -top-px left-0 h-[calc(1.75rem+1px)] w-7 rounded-bl-xl border-b border-l border-border/80" />
              {!isLast
                ? <span aria-hidden className="pointer-events-none absolute -bottom-px left-0 top-[calc(1.75rem-1px)] border-l border-border/80" />
                : null}
            </>
          )
        : null}
      <article className="group/comment relative flex min-w-0 gap-2.5 py-3">
        {hasVisibleContinuation
          ? <span aria-hidden className="pointer-events-none absolute -bottom-px left-4 top-11 border-l border-border/80" />
          : null}
        <Avatar className="size-8 shrink-0">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{comment.author.displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{comment.author.displayName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
            {comment.editedAt ? <span className="shrink-0 text-xs text-muted-foreground">已编辑</span> : null}
            {pending ? <LoaderCircle className="ml-auto size-3.5 animate-spin text-muted-foreground" aria-label="正在处理" /> : null}
          </div>
          {editing
            ? (
                <div className="mt-2">
                  <CommentComposer
                    draftKey={`edit:${comment.id}`}
                    initialValue={comment.body}
                    submitLabel="保存"
                    pending={pending}
                    pendingLabel="正在保存…"
                    disabled={pending}
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
              ? <p className="mt-1 text-sm italic text-muted-foreground">这条评论已删除</p>
              : <div className="mt-1"><CommentBody body={comment.body} /></div>}
          {!editing
            ? (
                <div className="mt-1 flex min-h-7 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/comment:opacity-100 md:group-focus-within/comment:opacity-100">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`回复 ${comment.author.displayName}`}
                        onClick={() => onReply({ commentId: comment.id, displayName: comment.author.displayName })}
                      >
                        <MessageCircle />
                        回复
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{`回复 ${comment.author.displayName}`}</TooltipContent>
                  </Tooltip>
                  {canManage && !confirmingDelete
                    ? (
                        <>
                          <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>编辑</Button>
                          <Button size="icon-xs" variant="ghost" aria-label="删除评论" onClick={() => setConfirmingDelete(true)}>
                            <Trash2 />
                          </Button>
                        </>
                      )
                    : null}
                  {canManage && confirmingDelete
                    ? (
                        <>
                          <Button size="xs" variant="destructive" disabled={pending} onClick={() => actions.deleteComment(thread, comment.id)}>确认删除</Button>
                          <Button size="xs" variant="ghost" onClick={() => setConfirmingDelete(false)}>取消</Button>
                        </>
                      )
                    : null}
                </div>
              )
            : null}
          {error ? <p role="alert" className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
      </article>
      {depth < 2
        ? (
            <div className="ml-4 min-w-0">
              <AnimatePresence>
                {visibleChildren.map((child, index) => (
                  <CommentNode
                    key={child.comment.id}
                    node={child}
                    depth={depth + 1}
                    thread={thread}
                    permissions={permissions}
                    actions={actions}
                    onReply={onReply}
                    onOpenReplies={onOpenReplies}
                    isLast={index === visibleChildren.length - 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          )
        : hiddenReplyCount > 0
          ? (
              <div className="relative ml-4 min-w-0 pb-2 pl-7 pt-1">
                <span aria-hidden className="pointer-events-none absolute -top-px left-0 h-[calc(1.25rem+1px)] w-7 rounded-bl-xl border-b border-l border-border/80" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 max-w-full rounded-lg px-2.5 text-xs font-normal"
                  onClick={() => onOpenReplies(comment.id)}
                >
                  <MessageCircle className="size-3.5" />
                  <span className="truncate">
                    继续查看
                    {' '}
                    {hiddenReplyCount}
                    {' '}
                    条回复
                  </span>
                </Button>
              </div>
            )
          : null}
    </motion.div>
  )
}

export function CommentTree({
  comments,
  thread,
  permissions,
  onReply,
}: {
  comments: ResumeComment[]
  thread: ResumeCommentThread
  permissions: CommentUiPermissions
  onReply: (target: CommentReplyTarget) => void
}) {
  const actions = useCommentActions()
  const reduceMotion = useReducedMotion()
  const [detailPath, setDetailPath] = useState<string[]>([])
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const tree = useMemo(() => buildCommentTree(comments), [comments])
  const detailRootId = detailPath.at(-1) ?? null
  const detailRoot = detailRootId ? tree.nodes.get(detailRootId) : null
  const roots = detailRoot ? [detailRoot] : tree.roots

  useEffect(() => {
    setDetailPath((current) => {
      const next = current.filter(id => tree.nodes.has(id))
      return next.length === current.length ? current : next
    })
  }, [tree.nodes])

  const openReplyDetail = (commentId: string) => {
    setNavigationDirection(1)
    setDetailPath(current => [...current, commentId])
  }

  const backReplyDetail = () => {
    setNavigationDirection(-1)
    setDetailPath(current => current.slice(0, -1))
  }

  return (
    <div className="min-w-0">
      <AnimatePresence mode="wait" custom={navigationDirection}>
        <motion.div
          key={detailRootId ?? 'comment-tree-root'}
          custom={navigationDirection}
          variants={{
            enter: (direction: number) => reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 12 },
            center: { opacity: 1, x: 0 },
            exit: (direction: number) => reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -12 },
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration, ease: COMMENT_MOTION.ease }}
        >
          {detailRoot
            ? (
                <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b bg-background px-1 py-2">
                  <Button size="icon-xs" variant="ghost" aria-label="返回上一级回复" onClick={backReplyDetail}>
                    <ArrowLeft />
                  </Button>
                  <span className="text-sm font-medium">回复详情</span>
                </div>
              )
            : null}
          <AnimatePresence>
            {roots.map((node, index) => (
              <CommentNode
                key={node.comment.id}
                node={node}
                depth={0}
                thread={thread}
                permissions={permissions}
                actions={actions}
                onReply={onReply}
                onOpenReplies={openReplyDetail}
                isLast={index === roots.length - 1}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
