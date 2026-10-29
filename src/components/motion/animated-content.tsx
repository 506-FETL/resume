import type { ReactNode, Ref } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'

interface AnimatedContentProps {
  animationKey: string | number
  children: ReactNode
  className?: string
  as?: 'div' | 'span'
  mode?: 'wait' | 'popLayout'
  enterDelay?: number
}

function Content({
  children,
  className,
  as = 'div',
  enterDelay = 0,
  ref,
}: Omit<AnimatedContentProps, 'animationKey' | 'mode'> & {
  ref?: Ref<HTMLDivElement & HTMLSpanElement>
}) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const Component = as === 'span' ? motion.span : motion.div

  return (
    <Component
      ref={ref}
      className={className}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: reduceMotion ? 1 : 0,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : DURATION.fast,
          ease: EASE.in,
          delay: 0,
        },
      }}
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
        delay: reduceMotion ? 0 : enterDelay,
      }}
    >
      {children}
    </Component>
  )
}

/** 只为语义状态切换设置 key，避免输入和同一状态的数据刷新重播动画。 */
export function AnimatedContent({
  animationKey,
  children,
  className,
  as,
  mode = 'wait',
  enterDelay,
}: AnimatedContentProps) {
  return (
    <AnimatePresence initial={false} mode={mode}>
      <Content
        key={animationKey}
        className={className}
        as={as}
        enterDelay={enterDelay}
      >
        {children}
      </Content>
    </AnimatePresence>
  )
}

export default AnimatedContent
