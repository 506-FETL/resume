import type { ReactNode, Ref } from 'react'
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'

function Panel({
  ref,
  children,
}: {
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}) {
  const present = useIsPresent()
  const reduce = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      inert={!present}
      aria-hidden={!present || undefined}
      className='flex min-h-0 min-w-0 flex-1 flex-col'
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: 0,
        transition: {
          duration: reduce ? 0 : DURATION.fast,
          ease: EASE.in,
          delay: 0,
        },
      }}
      transition={{
        duration: reduce ? 0 : DURATION.base,
        ease: EASE.out,
        delay: reduce ? 0 : DURATION.fast,
      }}
    >
      {children}
    </motion.div>
  )
}

/** 新面板立即初始化与占位，旧文字退出后再显示，避免内容叠在一起。 */
export default function ViewTransition({
  animationKey,
  className,
  children,
}: {
  animationKey: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('relative', className)}>
      <AnimatePresence initial={false} mode='popLayout'>
        <Panel key={animationKey}>{children}</Panel>
      </AnimatePresence>
    </div>
  )
}
