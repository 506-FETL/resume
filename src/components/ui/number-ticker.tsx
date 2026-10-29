import {
  type ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { animate, useInView, useMotionValue } from 'motion/react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DURATION, EASE } from '@/lib/motion'
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

  const formatter = useMemo(
    () =>
      Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }),
    [decimalPlaces],
  )

  const isInView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    const target = direction === 'down' ? startValue : value

    if (reduceMotion) {
      motionValue.jump(target)

      return
    }

    if (!isInView) return

    const animation = animate(motionValue, target, {
      duration: DURATION.slow,
      ease: EASE.out,
      delay,
    })

    return () => animation.stop()
  }, [motionValue, isInView, delay, value, direction, startValue, reduceMotion])

  useEffect(() => {
    const updateText = (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatter.format(latest)
      }
    }

    updateText(motionValue.get())

    return motionValue.on('change', updateText)
  }, [motionValue, formatter, reduceMotion, direction, startValue, value])

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
        ? formatter.format(direction === 'down' ? startValue : value)
        : direction === 'down'
          ? value
          : startValue}
    </span>
  )
}
