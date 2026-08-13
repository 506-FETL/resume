import type { PendingCommentSelection } from '../store/types.ts'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { countCommentGraphemes } from '../anchors/graphemes.ts'

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
  const selectedCount = countCommentGraphemes(selection.exactQuote)
  return (
    <>
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
      <div
        data-resume-comment-ui
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-60 md:hidden"
        onPointerDown={event => event.preventDefault()}
      >
        <Button
          disabled={disabled}
          className="h-11 w-full rounded-full bg-neutral-900 text-white shadow-xl hover:bg-neutral-800"
          aria-label={`已选择 ${selectedCount} 个字，添加评论`}
          onClick={onComment}
        >
          <MessageSquarePlus />
          <span>{`已选择 ${selectedCount} 个字 · 评论`}</span>
        </Button>
      </div>
    </>
  )
}
