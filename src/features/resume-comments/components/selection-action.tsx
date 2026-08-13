import type { PendingCommentSelection } from '../store/types.ts'
import { Link2, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { countCommentGraphemes } from '../anchors/graphemes.ts'

export function SelectionAction({
  selection,
  disabled,
  mode = 'comment',
  onComment,
}: {
  selection: PendingCommentSelection
  disabled?: boolean
  mode?: 'comment' | 'relink'
  onComment: () => void
}) {
  const lastRect = selection.clientRects.at(-1)
  if (!lastRect)
    return null
  const left = Math.min(Math.max(lastRect.right - 52, 12), window.innerWidth - 116)
  const top = Math.min(lastRect.bottom + 8, window.innerHeight - 48)
  const selectedCount = countCommentGraphemes(selection.exactQuote)
  const Icon = mode === 'relink' ? Link2 : MessageSquarePlus
  const label = mode === 'relink' ? '关联到此处' : '评论'
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
          <Icon />
          {label}
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
          aria-label={`已选择 ${selectedCount} 个字，${label}`}
          onClick={onComment}
        >
          <Icon />
          <span>{`已选择 ${selectedCount} 个字 · ${label}`}</span>
        </Button>
      </div>
    </>
  )
}
