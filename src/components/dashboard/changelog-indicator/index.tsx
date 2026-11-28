import { motion } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { useChangelogStatus } from '@/hooks/use-changelog-status'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function ChangelogIndicator({ className }: { className?: string }) {
  const { hasUnread } = useChangelogStatus()
  const reduceMotion = useReducedMotion()

  return (
    <Badge
      asChild
      className={cn(
        'pointer-events-none size-2 border-0 bg-destructive p-0',
        className,
      )}
    >
      <motion.span
        data-unread={hasUnread}
        aria-hidden={!hasUnread}
        initial={false}
        animate={{
          opacity: hasUnread ? 1 : 0,
          transform: hasUnread || reduceMotion ? 'scale(1)' : 'scale(0.96)',
        }}
        transition={{
          duration: reduceMotion
            ? 0
            : hasUnread
              ? DURATION.base
              : DURATION.fast,
          ease: EASE.out,
        }}
      >
        <span className='sr-only'>有未读更新</span>
      </motion.span>
    </Badge>
  )
}
