import type { RefObject } from 'react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** 入场先展示静态图，外框动画结束后再启动完整分页。 */
export function usePreviewReady(ref: RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reduce) return

    const overlay = ref.current?.closest(
      '[data-slot="dialog-content"], [data-slot="drawer-popup"]',
    )

    let active = true

    const check = () => {
      if (!active) return

      const animations = (overlay?.getAnimations() ?? []).filter(
        (animation) => animation.playState === 'running' || animation.pending,
      )

      if (animations.length) {
        // 取消或反向开关后重新读取当前动画，不使用固定超时猜测结束时间。
        Promise.allSettled(
          animations.map((animation) => animation.finished),
        ).then(check)

        return
      }

      setReady(true)
    }

    const frame = requestAnimationFrame(check)

    return () => {
      active = false
      cancelAnimationFrame(frame)
    }
  }, [ref, reduce])

  return reduce || ready
}
