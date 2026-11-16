'use client'

import type { SlidingNumberDisplayProps } from '../types'
import { useTransform, motion } from 'motion/react'

export function SlidingNumberDisplay({
  motionValue,
  number,
  height,
  transition,
}: SlidingNumberDisplayProps) {
  const y = useTransform(motionValue, (latest) => {
    if (!height) return 0

    const currentNumber = latest % 10
    const offset = (10 + number - currentNumber) % 10
    let translateY = offset * height

    if (offset > 5) translateY -= 10 * height

    return translateY
  })

  if (!height) {
    return (
      <span style={{ visibility: 'hidden', position: 'absolute' }}>
        {number}
      </span>
    )
  }

  return (
    <motion.span
      data-slot='sliding-number-display'
      style={{
        y,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      transition={{ ...transition, type: 'spring' }}
    >
      {number}
    </motion.span>
  )
}
