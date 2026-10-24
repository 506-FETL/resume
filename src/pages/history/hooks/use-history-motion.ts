import type { CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import { DURATION, EASE, SPRING } from '@/lib/motion'

export function useHistoryMotion() {
  const reduceMotion = Boolean(useReducedMotion())
  const enter = { duration: reduceMotion ? 0 : DURATION.base, ease: EASE.out }
  const exit = { duration: reduceMotion ? 0 : DURATION.fast, ease: EASE.in }
  const layout = reduceMotion ? { duration: 0 } : SPRING.layout

  const style = {
    '--history-fast': `${reduceMotion ? 0 : DURATION.fast}s`,
    '--history-base': `${reduceMotion ? 0 : DURATION.base}s`,
    '--history-ease': `cubic-bezier(${EASE.out.join(',')})`,
    '--history-exit-ease': `cubic-bezier(${EASE.in.join(',')})`,
  } as CSSProperties

  return {
    reduceMotion,
    enter,
    exit,
    layout,
    surfaceProps: {
      className: 'history-motion-surface',
      style,
      'data-reduced-motion': reduceMotion,
    },
  }
}
