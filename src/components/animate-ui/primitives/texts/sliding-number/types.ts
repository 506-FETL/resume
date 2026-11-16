'use client'

import type { SpringOptions, MotionValue, HTMLMotionProps } from 'motion/react'
import type { UseIsInViewOptions } from '@/hooks/use-is-in-view'

export type SlidingNumberRollerProps = {
  prevValue: number
  value: number
  place: number
  placeKey: string
  revision: number
  displayNumber: number
  transition: SpringOptions
  delay?: number
  onSettled?: (
    revision: number,
    displayNumber: number,
    placeKey: string,
  ) => void
}

export type SlidingNumberDisplayProps = {
  motionValue: MotionValue<number>
  number: number
  height: number
  transition: SpringOptions
}

export type SlidingNumberProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  number: number
  fromNumber?: number
  onNumberChange?: (number: number) => void
  onValueAnimationComplete?: (number: number) => void
  padStart?: boolean
  decimalSeparator?: string
  decimalPlaces?: number
  thousandSeparator?: string
  transition?: SpringOptions
  delay?: number
  initiallyStable?: boolean
} & UseIsInViewOptions
