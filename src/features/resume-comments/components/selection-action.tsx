import type { PendingCommentSelection } from '../store/types.ts'
import { Link2, MessageSquarePlus } from 'lucide-react'
import { motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { countCommentGraphemes } from '../anchors/graphemes.ts'
import { COMMENT_MOTION } from '../const.ts'

const SELECTION_ACTION_HIDDEN = { opacity: 0, y: 6, scale: 0.96 }
const SELECTION_ACTION_EXIT_EASE = [0.64, 0, 0.78, 0] as const

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
  const isPresent = useIsPresent()
  const reduceMotion = useReducedMotion()
  const lastRect = selection.clientRects.at(-1)
  if (!lastRect)
    return null
  const left = Math.min(Math.max(lastRect.right - 52, 12), window.innerWidth - 116)
  const top = Math.min(lastRect.bottom + 8, window.innerHeight - 48)
  const selectedCount = countCommentGraphemes(selection.exactQuote)
  const Icon = mode === 'relink' ? Link2 : MessageSquarePlus
  const label = mode === 'relink' ? '关联到此处' : '评论'
  const motionProps = {
    initial: reduceMotion ? false : SELECTION_ACTION_HIDDEN,
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reduceMotion ? 0 : COMMENT_MOTION.itemDuration,
        ease: COMMENT_MOTION.ease,
      },
    },
    exit: reduceMotion
      ? { opacity: 0, transition: { duration: 0 } }
      : {
          ...SELECTION_ACTION_HIDDEN,
          transition: {
            duration: 0.14,
            ease: SELECTION_ACTION_EXIT_EASE,
          },
        },
  }
  return (
    <>
      <motion.div
        {...motionProps}
        data-resume-comment-ui
        aria-hidden={!isPresent}
        className="fixed z-60 hidden md:block"
        style={{ left, top }}
        onPointerDown={event => event.preventDefault()}
      >
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !isPresent}
          onClick={onComment}
        >
          <Icon />
          {label}
        </Button>
      </motion.div>
      <motion.div
        {...motionProps}
        data-resume-comment-ui
        aria-hidden={!isPresent}
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-60 md:hidden"
        onPointerDown={event => event.preventDefault()}
      >
        <Button
          variant="outline"
          size="lg"
          disabled={disabled || !isPresent}
          className="w-full"
          aria-label={`已选择 ${selectedCount} 个字，${label}`}
          onClick={onComment}
        >
          <Icon />
          <span>{`已选择 ${selectedCount} 个字 · ${label}`}</span>
        </Button>
      </motion.div>
    </>
  )
}
