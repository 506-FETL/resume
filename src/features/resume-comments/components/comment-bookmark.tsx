import { MessageSquareText } from 'lucide-react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { DURATION, EASE } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { COMMENT_MOTION } from '../const.ts'

export function CommentBookmark({
  unread = false,
  disabled = false,
  className,
  onOpen,
}: {
  unread?: boolean
  disabled?: boolean
  className?: string
  onOpen: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <PresenceDiv
      data-resume-comment-ui
      initial={reduceMotion ? false : { opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{
        opacity: 0,
        x: reduceMotion ? 0 : 10,
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : COMMENT_MOTION.contentDuration,
        ease: COMMENT_MOTION.ease,
      }}
      className={cn(
        'fixed right-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] z-30',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='secondary'
            size='icon'
            disabled={disabled}
            aria-label='展开评论'
            data-resume-comment-trigger
            className='relative rounded-r-none rounded-l-xl border-r-0 shadow-[0_3px_12px_rgb(0_0_0/0.09)] transition-[width,background-color,box-shadow] hover:w-10 hover:shadow-[0_4px_14px_rgb(0_0_0/0.12)]'
            onClick={(event) => {
              event.currentTarget.blur()
              onOpen()
            }}
          >
            <MessageSquareText className='size-4' />
            {unread ? (
              <span
                className='absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-background'
                aria-label='有新评论'
              />
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='left'>展开评论</TooltipContent>
      </Tooltip>
    </PresenceDiv>
  )
}
