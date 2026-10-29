import { type ComponentPropsWithoutRef, useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number
  startValue?: number
  direction?: 'up' | 'down'
  delay?: number
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(direction === 'down' ? value : startValue)

  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  })

  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (reduceMotion) return
    if (isInView) {
      const timer = setTimeout(() => {
        motionValue.set(direction === 'down' ? startValue : value)
      }, delay * 1000)

      return () => clearTimeout(timer)
    }
  }, [motionValue, isInView, delay, value, direction, startValue, reduceMotion])

  useEffect(() => {
    const updateText = (latest: number) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)))
      }
    }

    if (reduceMotion) {
      const target = direction === 'down' ? startValue : value

      motionValue.jump(target)
      springValue.jump(target)
      updateText(target)

      return
    }

    updateText(springValue.get())

    return springValue.on('change', updateText)
  }, [
    springValue,
    motionValue,
    decimalPlaces,
    reduceMotion,
    direction,
    startValue,
    value,
  ])

  return (
    <span
      ref={ref}
      className={cn(
        'inline-block tracking-wider text-black tabular-nums dark:text-white',
        className,
      )}
      {...props}
    >
      {reduceMotion
        ? Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(direction === 'down' ? startValue : value)
        : direction === 'down'
          ? value
          : startValue}
    </span>
  )
}
