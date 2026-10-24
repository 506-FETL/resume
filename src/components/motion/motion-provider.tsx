import type { ReactNode } from 'react'
import { MotionConfig, useReducedMotion } from 'motion/react'
import { DURATION, EASE } from '@/lib/motion'

/** Portals and page content share the same timing tokens and accessibility preference. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()

  return (
    <MotionConfig
      reducedMotion='user'
      transition={{
        duration: reduceMotion ? 0 : DURATION.base,
        ease: EASE.out,
      }}
    >
      <style>
        {`:root {
        --ui-motion-fast: ${reduceMotion ? 0 : DURATION.fast}s;
        --ui-motion-base: ${reduceMotion ? 0 : DURATION.base}s;
        --ui-motion-slow: ${reduceMotion ? 0 : DURATION.slow}s;
        --ui-motion-enter-ease: cubic-bezier(${EASE.out.join(',')});
        --ui-motion-exit-ease: cubic-bezier(${EASE.in.join(',')});
      }`}
      </style>
      {children}
    </MotionConfig>
  )
}
