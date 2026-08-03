import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

// 数字滚动到目标值。reduced-motion 或首帧直接落终值，避免无障碍下的动画。
export function useCountUp(target: number, duration = 500): number {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduce) {
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
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1)
        rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current)
        cancelAnimationFrame(rafRef.current)
      fromRef.current = target
    }
  }, [target, duration, reduce])

  return value
}
