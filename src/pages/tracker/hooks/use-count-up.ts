import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useEffect, useRef, useState } from 'react'
import { DURATION } from '@/lib/motion'

// 数字滚动到目标值。reduced-motion 或首帧直接落终值，避免无障碍下的动画。
export function useCountUp(
  target: number,
  duration = DURATION.fast * 1000,
): number {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce || duration <= 0) {
      fromRef.current = target
      setValue(target)

      return
    }

    const from = fromRef.current

    if (from === target) {
      setValue(target)

      return
    }

    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3

      const nextValue = Math.round(from + (target - from) * eased)

      fromRef.current = nextValue
      setValue(nextValue)

      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else rafRef.current = null
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

      rafRef.current = null
    }
  }, [target, duration, reduce])

  return value
}
