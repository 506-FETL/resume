import type { PendingCommentSelection } from '../store/types.ts'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SelectionAction({
  selection,
  disabled,
  onComment,
}: {
  selection: PendingCommentSelection
  disabled?: boolean
  onComment: () => void
}) {
  const lastRect = selection.clientRects.at(-1)
  if (!lastRect)
    return null
  const left = Math.min(Math.max(lastRect.right - 52, 12), window.innerWidth - 116)
  const top = Math.min(lastRect.bottom + 8, window.innerHeight - 48)
  return (
    <div
      data-resume-comment-ui
      className="fixed z-60 hidden md:block"
      style={{ left, top }}
      onPointerDown={event => event.preventDefault()}
    >
      <Button
        size="sm"
        disabled={disabled}
        className="rounded-full bg-neutral-900 text-white shadow-xl hover:bg-neutral-800"
        onClick={onComment}
      >
        <MessageSquarePlus />
        评论
      </Button>
    </div>
  )
}
