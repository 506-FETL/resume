'use client'

import type { SlidingNumberRollerProps } from '../types'
import { useSpring } from 'motion/react'
import * as React from 'react'
import useMeasure from 'react-use-measure'
import { SlidingNumberDisplay } from '../display'

export function SlidingNumberRoller({
  prevValue,
  value,
  place,
  placeKey,
  revision,
  displayNumber,
  transition,
  delay = 0,
  onSettled,
}: SlidingNumberRollerProps) {
  const startNumber = Math.floor(prevValue / place) % 10
  const targetNumber = Math.floor(value / place) % 10
  const animatedValue = useSpring(startNumber, transition)
  const onSettledRef = React.useRef(onSettled)

  onSettledRef.current = onSettled

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let didSettle = false

    const markSettled = () => {
      if (didSettle) return

      didSettle = true
      onSettledRef.current?.(revision, displayNumber, placeKey)
    }

    const timeoutId = setTimeout(() => {
      if (
        animatedValue.get() === targetNumber &&
        !animatedValue.isAnimating()
      ) {
        markSettled()

        return
      }

      unsubscribe = animatedValue.on('animationComplete', markSettled)
      animatedValue.set(targetNumber)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      unsubscribe?.()
    }
  }, [targetNumber, animatedValue, delay, revision, displayNumber, placeKey])

  const [measureRef, { height }] = useMeasure()

  return (
    <span
      ref={measureRef}
      data-slot='sliding-number-roller'
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '1ch',
        overflowX: 'visible',
        overflowY: 'clip',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ visibility: 'hidden' }}>0</span>
      {Array.from({ length: 10 }, (_, i) => (
        <SlidingNumberDisplay
          key={i}
          motionValue={animatedValue}
          number={i}
          height={height}
          transition={transition}
        />
      ))}
    </span>
  )
}
