import type { ResumeCommentThread } from '../types.ts'
import { X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { COMMENT_MOTION } from '../const.ts'

export function ThreadPicker({
  threads,
  point,
  onSelect,
  onClose,
}: {
  threads: ResumeCommentThread[]
  point: { x: number, y: number }
  onSelect: (threadId: string) => void
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const left = Math.min(Math.max(point.x + 8, 12), Math.max(12, window.innerWidth - 332))
  const top = Math.min(Math.max(point.y + 8, 12), window.innerHeight - 260)
  return (
    <motion.div
      data-resume-comment-ui
      role="presentation"
      className="fixed inset-0 z-60"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : COMMENT_MOTION.highlightDuration }}
      onPointerDown={onClose}
    >
      <motion.div
        data-resume-comment-ui
        role="dialog"
        aria-label="选择评论线程"
        className="absolute w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        style={{ left, top }}
        initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration, ease: COMMENT_MOTION.ease }}
        onPointerDown={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">
            此处有
            {threads.length}
            {' '}
            条评论
          </p>
          <Button size="icon-xs" variant="ghost" aria-label="关闭" onClick={onClose}><X /></Button>
        </div>
        <div className="max-h-52 space-y-1 overflow-y-auto p-2">
          {threads.map((thread) => {
            const root = thread.comments.find(comment => comment.parentId === null)
            return (
              <Button
                key={thread.id}
                variant="ghost"
                className="h-auto w-full items-start justify-start whitespace-normal p-2 text-left"
                onClick={() => onSelect(thread.id)}
              >
                <span className="min-w-0 space-y-1">
                  <span className="line-clamp-1 block border-l-2 border-amber-300 pl-2 text-xs text-muted-foreground">
                    {thread.anchor.exactQuote}
                  </span>
                  <span className="line-clamp-2 block text-sm">{root?.deletedAt ? '原评论已删除' : root?.body}</span>
                  <span className="block text-xs text-muted-foreground">{root?.author.displayName ?? '已删除用户'}</span>
                </span>
              </Button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
