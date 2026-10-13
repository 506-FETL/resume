import type { ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'

interface AnimatedContentProps {
  animationKey: string | number
  children: ReactNode
  className?: string
  as?: 'div' | 'span'
}

function Content({ children, className, as = 'div' }: Omit<AnimatedContentProps, 'animationKey'>) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const Component = as === 'span' ? motion.span : motion.div

  return (
    <Component
      className={className}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: reduceMotion ? 1 : 0, y: 0, transition: { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in } }}
      transition={{ duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }}
    >
      {children}
    </Component>
  )
}

/** 只为语义状态切换设置 key，避免输入和同一状态的数据刷新重播动画。 */
export function AnimatedContent({ animationKey, children, className, as }: AnimatedContentProps) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <Content key={animationKey} className={className} as={as}>
        {children}
      </Content>
    </AnimatePresence>
  )
}

export default AnimatedContent
