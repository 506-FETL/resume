import type { ComponentProps, ReactNode, Ref } from 'react'
import { AnimatePresence } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { PresenceDiv } from '@/components/motion/presence-item'
import { CONTENT_SWITCH } from '@/lib/motion'
import { cn } from '@/lib/utils'

function Panel({
  ref,
  children,
}: {
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}) {
  const reduce = useReducedMotion()

  return (
    <PresenceDiv
      ref={ref}
      className='flex min-h-0 min-w-0 flex-1 flex-col'
      initial={reduce ? false : { opacity: 0, transform: 'translateY(4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{
        opacity: 0,
        transform: 'translateY(0px)',
        transition: {
          ...CONTENT_SWITCH.exit,
          ...(reduce && { duration: 0 }),
          delay: 0,
        },
      }}
      transition={{
        ...CONTENT_SWITCH.enter,
        ...(reduce && { duration: 0 }),
        delay: reduce ? 0 : CONTENT_SWITCH.exit.duration,
      }}
    >
      {children}
    </PresenceDiv>
  )
}

/** 新面板立即初始化与占位，旧文字退出后再显示，避免内容叠在一起。 */
export default function ViewTransition({
  animationKey,
  className,
  children,
  ...props
}: {
  animationKey: string
} & ComponentProps<'div'>) {
  return (
    <div className={cn('relative', className)} {...props}>
      <AnimatePresence initial={false} mode='popLayout'>
        <Panel key={animationKey}>{children}</Panel>
      </AnimatePresence>
    </div>
  )
}
