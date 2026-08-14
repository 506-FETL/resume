import type { ResumeCommentThread } from '../types.ts'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  const left = Math.min(Math.max(point.x + 8, 12), window.innerWidth - 332)
  const top = Math.min(Math.max(point.y + 8, 12), window.innerHeight - 260)
  return (
    <div
      data-resume-comment-ui
      role="dialog"
      aria-label="选择评论线程"
      className="fixed z-60 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
      style={{ left, top }}
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
    </div>
  )
}
