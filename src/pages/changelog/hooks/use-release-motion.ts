import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE, staggerDelay } from '@/lib/motion'

export function useReleaseMotion(index = 0) {
  const reduceMotion = useReducedMotion()

  return {
    initial: reduceMotion
      ? false
      : { opacity: 0, transform: 'translateY(8px)' },
    whileInView: { opacity: 1, transform: 'translateY(0px)' },
    viewport: { once: true, amount: 0.08 },
    transition: {
      duration: reduceMotion ? 0 : DURATION.base,
      delay: reduceMotion ? 0 : staggerDelay(index),
      ease: EASE.out,
    },
  } as const
}
