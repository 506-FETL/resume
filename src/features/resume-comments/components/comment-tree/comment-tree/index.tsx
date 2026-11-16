import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { COMMENT_MOTION } from '../../../const.ts'
import { useResumeCommentStore } from '../../../context.tsx'
import { useCommentActions } from '../../../hooks/use-comment-actions.ts'
import type { ResumeComment, ResumeCommentThread } from '../../../types.ts'
import type { CommentUiPermissions } from '../../types.ts'
import { CommentNode } from '../comment-node'
import type { CommentReplyTarget } from '../tree-model'
import { buildCommentTree } from '../tree-model'

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

  const commentRenderKeys = useResumeCommentStore(
    (state) => state.commentRenderKeys,
  )

  const [detailPath, setDetailPath] = useState<string[]>([])
  const [navigationDirection, setNavigationDirection] = useState<1 | -1>(1)
  const tree = useMemo(() => buildCommentTree(comments), [comments])
  const detailRootId = detailPath.at(-1) ?? null
  const detailRoot = detailRootId ? tree.nodes.get(detailRootId) : null
  const roots = detailRoot ? [detailRoot] : tree.roots

  useEffect(() => {
    setDetailPath((current) => {
      const next = current.filter((id) => tree.nodes.has(id))

      return next.length === current.length ? current : next
    })
  }, [tree.nodes])

  const openReplyDetail = (commentId: string) => {
    setNavigationDirection(1)
    setDetailPath((current) => [...current, commentId])
  }

  const backReplyDetail = () => {
    setNavigationDirection(-1)
    setDetailPath((current) => current.slice(0, -1))
  }

  return (
    <div className='min-w-0'>
      <AnimatePresence mode='wait' custom={navigationDirection}>
        <motion.div
          key={detailRootId ?? 'comment-tree-root'}
          custom={navigationDirection}
          variants={{
            enter: (direction: number) =>
              reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 12 },
            center: { opacity: 1, x: 0 },
            exit: (direction: number) =>
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: direction * -12 },
          }}
          initial='enter'
          animate='center'
          exit='exit'
          transition={{
            duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration,
            ease: COMMENT_MOTION.ease,
          }}
        >
          {detailRoot ? (
            <div className='sticky top-0 z-10 -mx-1 flex items-center gap-2 border-b bg-background px-1 py-2'>
              <Button
                size='icon-xs'
                variant='ghost'
                aria-label='返回上一级回复'
                onClick={backReplyDetail}
              >
                <ArrowLeft />
              </Button>
              <span className='text-sm font-medium'>回复详情</span>
            </div>
          ) : null}
          <AnimatePresence>
            {roots.map((node, index) => (
              <CommentNode
                key={commentRenderKeys[node.comment.id] ?? node.comment.id}
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
